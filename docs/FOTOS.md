# Fotos dos anúncios (Req. 004)

Este documento explica como as fotos dos anúncios são enviadas, conferidas, exibidas e apagadas, como configurar o
Amazon S3 e o que ainda falta validar num bucket real.

## 1. Dois adaptadores, a mesma interface

As rotas só conhecem a interface `ArmazenamentoFotos` (`backend/catalogo/src/fotos.ts`), o mesmo nome do diagrama
de classes do UC02:

| Adaptador | Quando é usado | Onde fica a foto |
| --- | --- | --- |
| `ArmazenamentoS3` (`fotos-s3.ts`) | `S3_BUCKET` definido (produção) | bucket do Amazon S3 |
| `ArmazenamentoLocal` (`fotos.ts`) | `S3_BUCKET` vazio (desenvolvimento e testes) | pasta `backend/fotos/` (ou `PASTA_FOTOS`), fora do Git |

O catálogo escolhe sozinho ao iniciar e mostra no log qual está em uso. O adaptador local não serve para
produção: no Render grátis a pasta é apagada a cada deploy.

## 2. Como funciona com o S3

O navegador nunca manda a foto pela rota do anúncio: ele recebe um **POST pré-assinado** e envia o arquivo direto
ao bucket, como prevê a arquitetura (§5.2).

| Etapa | Onde | O que acontece |
| --- | --- | --- |
| 1. Pedido de envio | `POST /anuncios/fotos` | Exige login e chave Pix. Aceita de 1 a 5 arquivos, só `image/jpeg`, `image/png` ou `image/webp`, até 5 MB cada. Registra cada envio autorizado em nome da vendedora e devolve, para cada foto, a URL do bucket e os campos assinados. |
| 2. Envio | navegador → `https://<bucket>.s3.<região>.amazonaws.com` | POST `multipart/form-data` com os campos e o arquivo por último. A **política assinada** só aceita a chave `temporarias/<chave>`, aquele `Content-Type` e de 1 byte a 5 MB, por 10 minutos. Fora disso, o próprio S3 recusa. |
| 3. Conferência | `POST /anuncios` ou `PUT /anuncios/:id` | Primeiro a API confere que cada foto é um envio autorizado **desta vendedora** e que não está em outro anúncio (sem tocar no bucket). Depois lê os 12 primeiros bytes de `temporarias/<chave>` e confere tamanho total, `Content-Type` e assinatura do formato (um texto com nome `.png` é recusado). Só então copia o objeto para `anuncios/<chave>`, com `CopySourceIfMatch` no ETag lido, para que um arquivo trocado no meio do caminho não seja publicado. |
| 4. Vínculo | dentro da fila da loja | A foto é marcada como conferida e vinculada ao anúncio. A primeira vira a capa (`fotoUrl`). |
| 5. Exibição | `next/image` | A URL salva é `https://<bucket ou CDN>/anuncios/<chave>`. |
| 6. Troca | `PUT /anuncios/:id` | As fotos novas são conferidas antes. As que saíram só são apagadas de `anuncios/` **depois** que o anúncio foi salvo. Se apagar falhar, a edição continua valendo e o erro vai para o log. |
| 7. Exclusão | `DELETE /anuncios/:id` | O anúncio sai e depois as fotos são apagadas de `anuncios/`. |

Com o adaptador local, o passo 2 é um `PUT /fotos/:chave` com assinatura HMAC (a própria API confere tipo, tamanho
e primeiros bytes) e a exibição é por `GET /fotos/:chave`. Essas duas rotas só existem com o adaptador local.

## 3. Configuração do bucket

### 3.1 Criar o bucket

- Região: `us-east-2` (Ohio), a mesma do Render e do Supabase.
- Nome: só letras minúsculas, números e hífen, **sem ponto** (com ponto, o endereço HTTPS do bucket não bate com o
  certificado). Exemplo fictício: `desapego-fotos`.
- Criptografia padrão (SSE-S3) ligada e versionamento ligado (§8.1 da arquitetura).
- *Object Ownership*: "Bucket owner enforced" (ACLs desligadas).

### 3.2 Leitura pública só de `anuncios/`

As fotos publicadas precisam ser lidas pelo navegador e pelo otimizador do `next/image`. As temporárias não. Há
duas opções:

- **Com CDN (recomendado, §4.1):** CloudFront com *Origin Access Control* apontando para o bucket, comportamento só
  para `/anuncios/*`, e o bucket continua **todo privado**. Defina `S3_URL_PUBLICA` com o endereço da CDN.
- **Sem CDN:** desligue só a opção "Block public access → bucket policies" e libere leitura apenas do prefixo:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "LeituraPublicaDasFotosPublicadas",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::desapego-fotos/anuncios/*"
    }
  ]
}
```

### 3.3 CORS (envio direto do navegador)

```json
[
  {
    "AllowedOrigins": ["https://desapego.onrender.com", "http://localhost:3000"],
    "AllowedMethods": ["POST"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3000
  }
]
```

Tire `http://localhost:3000` se o bucket for só de produção. Leitura de imagem não precisa de CORS.

### 3.4 Limpeza automática das temporárias

Regra de ciclo de vida: prefixo `temporarias/`, expirar objetos depois de **1 dia**. Assim, fotos enviadas e nunca
publicadas somem sozinhas.

### 3.5 Permissões mínimas do usuário da aplicação (IAM)

Um usuário IAM só para o catálogo, com chave de acesso e esta política (troque o nome do bucket):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "EnviarTemporarias",
      "Effect": "Allow",
      "Action": "s3:PutObject",
      "Resource": "arn:aws:s3:::desapego-fotos/temporarias/*"
    },
    {
      "Sid": "ConferirTemporarias",
      "Effect": "Allow",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::desapego-fotos/temporarias/*"
    },
    {
      "Sid": "PublicarEApagar",
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::desapego-fotos/anuncios/*"
    }
  ]
}
```

- `PutObject` em `temporarias/` é o que o POST pré-assinado usa (a assinatura é feita com esta chave).
- `GetObject` em `temporarias/` é a leitura dos primeiros bytes. `CopyObject` precisa dele na origem e de
  `PutObject` no destino.
- A aplicação não lista, não muda a política do bucket e não lê `anuncios/` (a leitura é pública ou pela CDN).

## 4. Variáveis de ambiente

No `.env` local (fora do Git) e no painel do Render (`sync: false` no `render.yaml`). **Nunca no repositório.**

| Variável | Exemplo fictício | Para quê |
| --- | --- | --- |
| `S3_BUCKET` | `desapego-fotos` | liga o S3; vazio = armazenamento local |
| `AWS_REGION` | `us-east-2` | região do bucket |
| `AWS_ACCESS_KEY_ID` | *(do usuário IAM)* | credencial da aplicação (segredo) |
| `AWS_SECRET_ACCESS_KEY` | *(do usuário IAM)* | credencial da aplicação (segredo) |
| `S3_URL_PUBLICA` | `https://fotos.example.test` | opcional: CDN; vazio = `https://<bucket>.s3.<região>.amazonaws.com` |

O `next.config.ts` lê `S3_BUCKET`, `AWS_REGION` e `S3_URL_PUBLICA` **no build** para liberar na CSP só dois
endereços: o do bucket em `connect-src` (envio) e o das fotos em `img-src`. No `next/image`, libera só o caminho
`/anuncios/**` desse host. Nomes fora do padrão interrompem o build, para não injetar nada na CSP. Depois de mudar
essas variáveis no Render, faça um novo deploy.

## 5. O que foi testado e o que falta validar no bucket real

**Testado localmente** (sem acesso a um bucket):

- política do POST assinada de verdade pela biblioteca da AWS com credenciais fictícias: caminho, tipo, 1 byte a
  5 MB e prazo (`fotos-s3-politica.test.ts`);
- conferência de primeiros bytes e tamanho e cópia condicionada ao ETag, com cliente S3 simulado (`fotos-s3.test.ts`);
- rotas com um bucket simulado: dona antes do bucket, arquivo falso não entra, troca só apaga depois de salvar,
  falha ao apagar não desfaz a edição, exclusão (`anuncios.test.ts`);
- envio pelo navegador (POST com campos e arquivo por último; PUT no local) em `frontend/src/lib/api/anuncios.test.ts`;
- CSP e `next/image` gerados com e sem bucket.

**Falta validar com um bucket de teste** (precisa de conta AWS e de um usuário IAM autorizado pelo grupo):

1. POST real do navegador: CORS, resposta 204 e recusa do S3 para arquivo acima de 5 MB e para outro `Content-Type`.
2. `GetObject` com `Range` e `CopyObject` com `CopySourceIfMatch` nas permissões mínimas acima.
3. Leitura pública de `anuncios/` (ou pela CDN) e otimização pelo `next/image` em produção.
4. Regra de ciclo de vida apagando `temporarias/`.
5. Exclusão e troca apagando os objetos certos.

## 6. Limitações que continuam

- Os registros de envio (`fotos` no `db.json`) e as **peças do catálogo** ainda ficam no `db.json`, que o Render
  grátis apaga a cada deploy. É uma pendência separada: veja [`PERSISTENCIA-CATALOGO.md`](PERSISTENCIA-CATALOGO.md).
- Sem miniaturas nem conversão para WebP/AVIF no envio (§4.1); o `next/image` otimiza na exibição.
- Ao excluir a conta da vendedora, as fotos dos anúncios dela ainda não são apagadas (LGPD).
