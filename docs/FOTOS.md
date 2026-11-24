# Fotos dos anúncios (Req. 004)

Este documento explica como as fotos dos anúncios são enviadas, conferidas, exibidas e apagadas, como configurar o
**Supabase Storage** (plano gratuito, o mesmo projeto das contas) e o que ainda falta validar no projeto hospedado.
O Amazon S3 da arquitetura fica para uma etapa futura (PR #45, em rascunho): a interface é a mesma.

## 1. Adaptadores

As rotas só conhecem a interface `ArmazenamentoFotos` (`backend/catalogo/src/fotos.ts`), o nome do diagrama de
classes do UC02:

| Adaptador | Quando é usado | Onde fica a foto |
| --- | --- | --- |
| `ArmazenamentoSupabase` (`fotos-supabase.ts`) | `SUPABASE_URL` e `SUPABASE_SECRET_KEY` definidos (produção) | buckets do Supabase Storage |
| `ArmazenamentoLocal` (`fotos.ts`) | sem essas variáveis (desenvolvimento e testes) | pasta `backend/fotos/` (ou `PASTA_FOTOS`), fora do Git |

O catálogo escolhe sozinho ao iniciar e mostra no log qual está em uso. Em produção sem o Supabase, ele avisa: no
Render grátis a pasta local é apagada a cada deploy.

## 2. Como funciona com o Supabase Storage

Dois buckets no mesmo projeto:

- **`anuncios-envios`** (privado): recebe o arquivo direto do navegador. Só aceita JPG, PNG e WebP de até 5 MB.
- **`anuncios-fotos`** (público para leitura): só recebe a foto depois que a API a conferiu.

| Etapa | Onde | O que acontece |
| --- | --- | --- |
| 1. Pedido de envio | `POST /anuncios/fotos` | Exige login e chave Pix. Aceita de 1 a 5 arquivos, só `image/jpeg`, `image/png` ou `image/webp`, até 5 MB cada. Registra cada envio autorizado em nome da vendedora e devolve uma **URL de envio assinada** do Supabase para cada foto. |
| 2. Envio | navegador → `PUT https://<projeto>.supabase.co/storage/v1/object/upload/sign/anuncios-envios/<chave>?token=…` | A URL vale só para aquele caminho, por 2 horas, e **não sobrescreve** um arquivo que já esteja lá. O próprio bucket recusa outro tipo e arquivo acima de 5 MB. O navegador nunca recebe a chave secreta. |
| 3. Conferência | `POST /anuncios` ou `PUT /anuncios/:id` | Primeiro a API confere que cada foto é um envio autorizado **desta vendedora** e que não está em outro anúncio, sem tocar no Storage. Depois lê os 12 primeiros bytes do envio e confere tamanho total, tipo gravado e assinatura do formato (um texto com nome `.png` é recusado). Só então copia o arquivo para `anuncios-fotos`. |
| 4. Vínculo | dentro da fila da loja | A foto é marcada como conferida e vinculada ao anúncio (`fotos.peca_id` no banco). A primeira vira a capa (`fotoUrl`). Depois de salvo, a cópia em `anuncios-envios` é apagada. |
| 5. Exibição | `next/image` | `https://<projeto>.supabase.co/storage/v1/object/public/anuncios-fotos/<chave>`. |
| 6. Troca | `PUT /anuncios/:id` | As fotos novas são conferidas antes. As que saíram só são apagadas **depois** que o anúncio foi salvo. Se apagar falhar, a edição continua valendo e o erro vai para o log. |
| 7. Exclusão | `DELETE /anuncios/:id` | O anúncio sai e depois as fotos são apagadas de `anuncios-fotos`. |
| 8. Limpeza | a cada hora (`servidor.ts`) | Envios pedidos há mais de 24 horas que não entraram em anúncio são apagados (registro e arquivo). |

Como a URL assinada não sobrescreve, o arquivo copiado na etapa 3 é o mesmo que foi conferido. Outra vendedora não
consegue usar, trocar nem apagar fotos de um anúncio que não é dela: a API recusa antes de chamar o Storage.

Com o adaptador local, a etapa 2 é um `PUT /fotos/:chave` com assinatura HMAC (a própria API confere tipo, tamanho e
primeiros bytes) e a exibição é por `GET /fotos/:chave`. Essas duas rotas só existem com o adaptador local.

## 3. Cabe no plano gratuito?

Limites do plano gratuito do Supabase (página de preços, novembro de 2026):

| Recurso | Limite | Uso esperado no MVP |
| --- | --- | --- |
| Armazenamento de arquivos | 1 GB | até 5 MB por foto: no pior caso, cerca de 200 fotos; com fotos de celular de 2 a 3 MB, de 300 a 500 |
| Tráfego (egress) | 5 GB por mês, mais 5 GB de egress em cache | o `next/image` guarda a versão otimizada por 30 dias (`minimumCacheTTL`), então cada original sai do Supabase poucas vezes |
| Banco de dados | 500 MB | o catálogo ocupa poucos MB |
| Tamanho máximo de arquivo | 50 MB | o bucket limita a 5 MB |

**Conclusão:** cabe para o MVP e a demonstração. Os riscos são:

- o Render grátis dorme e perde o cache do `next/image`, e cada volta baixa as fotos de novo;
- o projeto gratuito do Supabase pausa depois de 7 dias sem uso (vale também para as contas);
- sem transformação de imagem no Storage, que só existe no plano pago.

Se o tráfego apertar, o próximo passo é reduzir as fotos no navegador antes do envio.

## 4. Configuração no Supabase (precisa de aprovação do grupo)

Nada disto foi feito no projeto hospedado. No SQL Editor do projeto:

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('anuncios-envios', 'anuncios-envios', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('anuncios-fotos', 'anuncios-fotos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
```

- **Não crie políticas (RLS)** em `storage.objects` para esses buckets. Sem política, ninguém de fora lista, envia
  nem apaga. O envio funciona só pela URL assinada pelo servidor. A leitura de `anuncios-fotos` é pública porque o
  bucket é público, e `anuncios-envios` não tem leitura pública.
- **Chave:** em *Project Settings → API Keys*, use uma **secret key** (`sb_secret_…`) ou a `service_role`
  legada. Ela fica **só no servidor** (Render, `sync: false`), nunca no frontend nem no Git.
- **CORS:** o Storage do Supabase responde ao navegador de qualquer origem; a URL assinada é que autoriza. Não há
  nada a configurar (confira no item 2 da seção 6).

## 5. Variáveis de ambiente

No `.env` local (fora do Git) e no painel do Render. **Nunca no repositório.**

| Variável | Exemplo fictício | Para quê |
| --- | --- | --- |
| `SUPABASE_URL` | `https://abcdefgh.supabase.co` | liga o Supabase Storage; também libera o host na CSP e no `next/image` (lida no build) |
| `SUPABASE_SECRET_KEY` | *(secret key do projeto)* | segredo do servidor para assinar envios, ler, copiar e apagar |

As duas vão juntas: só uma delas é erro de configuração. O `next.config.ts` libera na CSP só a origem do projeto
(`connect-src` para o envio e `img-src` para a prévia) e, no `next/image`, só o caminho
`/storage/v1/object/public/anuncios-fotos/**`. Depois de mudar `SUPABASE_URL` no Render, faça um novo deploy.

## 6. O que foi testado e o que falta validar

**Testado localmente**, com um Supabase Storage simulado (`storage-simulado.ts`, com as mesmas rotas e as regras
dos buckets) e o pg-mem:

- envio pela URL assinada, conferência, cópia para o bucket público e exibição (`fotos-supabase.test.ts`);
- o bucket recusando outro tipo e mais de 5 MB, e a URL que não sobrescreve;
- arquivo falso com tipo de imagem que não entra no anúncio;
- permissões: outra vendedora não usa, troca nem apaga, e a recusa acontece antes de chamar o Storage;
- troca que só apaga a antiga depois de salvar, exclusão e limpeza dos envios abandonados (`anuncios.test.ts`);
- CSP e `next/image` gerados com e sem `SUPABASE_URL`.

**Falta validar no Supabase de verdade** (precisa do acesso ao projeto):

1. Criar os buckets (SQL acima) e conferir o limite de 5 MB e os tipos aceitos.
2. Envio do navegador em produção: CORS, `PUT` com o arquivo no corpo, resposta 200 e recusa de outro tipo e acima
   de 5 MB.
3. `GET /object/authenticated` com `Range` respondendo 206 e `Content-Range`. O código também aceita 200 com o
   arquivo inteiro.
4. `POST /object/copy` entre buckets (`destinationBucket`) com a chave secreta.
5. Exibição pelo `next/image` no Render e apagar na troca e na exclusão.
6. Uso de armazenamento e de egress no painel depois da demonstração.

## 7. Limitações que continuam

- Sem miniaturas nem conversão para WebP/AVIF no envio; o `next/image` otimiza na exibição.
- Ao excluir a conta da vendedora, as fotos dos anúncios dela ainda não são apagadas (LGPD).
- Sem versionamento das fotos: no plano gratuito não há backup do Storage.
