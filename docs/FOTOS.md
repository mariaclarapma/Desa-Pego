# Fotos dos anúncios (Req. 004)

Este documento explica como as fotos dos anúncios são enviadas e guardadas hoje, qual é a limitação atual e o que
falta para usar em produção.

## 1. Como funciona

O navegador nunca manda a foto pela rota do anúncio. Ele pede uma **URL pré-assinada** e envia o arquivo direto para
o armazenamento, como prevê a arquitetura (§5.2, Amazon S3 com URL pré-assinada).

| Etapa | Onde | O que acontece |
| --- | --- | --- |
| Pedido de envio | `POST /anuncios/fotos` (catálogo) | Exige login e chave Pix. Aceita de 1 a 5 arquivos, só `image/jpeg`, `image/png` ou `image/webp`, até 5 MB cada. Devolve, para cada foto, uma chave e uma URL assinada (HMAC-SHA256) que vale 10 minutos, para aquele tipo e aquele tamanho máximo. |
| Envio | `PUT /fotos/:chave?…&sig=…` | Sem token: a assinatura autoriza. Confere a assinatura, o prazo, o `Content-Type` e os **primeiros bytes do arquivo** (um texto com o nome `.png` é recusado com 415). Cada URL vale para um envio só. |
| Uso no anúncio | `POST /anuncios`, `PUT /anuncios/:id` | Só aceita fotos que a própria conta enviou e que não estão em outro anúncio. A primeira vira a capa (`fotoUrl`). |
| Exibição | `GET /fotos/:chave` | Pública, com cache longo (a chave nunca muda de conteúdo). |
| Remoção | `PUT /anuncios/:id` e `DELETE /anuncios/:id` | Fotos que saem do anúncio, ou do anúncio excluído, são apagadas do armazenamento. |

O armazenamento fica atrás da interface `ArmazenamentoFotos` (`backend/catalogo/src/fotos.ts`), o mesmo nome do
diagrama de classes do UC02. As rotas não sabem onde a foto fica.

## 2. Limitação atual

Hoje só existe o **`ArmazenamentoLocal`**: as fotos ficam numa pasta do servidor do catálogo (`backend/fotos/`, ou a
pasta da variável `PASTA_FOTOS`), fora do Git.

> **No Render (plano grátis), o disco é apagado a cada deploy e a cada reinício.** Todas as fotos somem, e os anúncios
> ficam com a imagem quebrada. Serve para desenvolvimento, testes e demonstração local, **não para produção**.

Outras limitações da versão local:

- uma única instância do catálogo (a pasta não é compartilhada);
- sem CDN, sem miniaturas e sem conversão para WebP/AVIF (§4.1 da arquitetura);
- a URL assinada usa o `JWT_SECRET` como segredo do HMAC; um adaptador de nuvem usaria as credenciais do provedor;
- fotos pedidas e nunca usadas num anúncio ficam no registro (`fotos` em `db.json`) e na pasta até alguém limpar.

## 3. Decisão pendente do grupo

O documento de arquitetura escolhe o **Amazon S3**, mas nada foi configurado (não há bucket nem credenciais). Como o
grupo já usa o Supabase, há duas opções:

| Opção | Prós | Contras |
| --- | --- | --- |
| **Supabase Storage** | o projeto já usa Supabase; tem URL assinada para envio (`createSignedUploadUrl`); plano grátis de 1 GB | diverge do "S3" escrito na arquitetura: precisa de um ADR registrando a troca |
| **Amazon S3** | segue a arquitetura à risca; integra com CloudFront/Cloudflare | exige conta AWS com cartão, usuário IAM e credenciais novas no Render |

## 4. O que falta para produção

1. **Decidir** entre Supabase Storage e S3 e registrar a decisão (ADR no documento de arquitetura).
2. **Criar o bucket** com leitura pública só das fotos publicadas, e escrita apenas por URL assinada.
3. **Escrever o adaptador** (`ArmazenamentoSupabase` ou `ArmazenamentoS3`) com os mesmos métodos de `ArmazenamentoFotos`
   e trocar o `new ArmazenamentoLocal(...)` em `backend/catalogo/src/servidor.ts`. As rotas e os testes de regra não mudam.
4. **Variáveis no Render** (nunca no Git): por exemplo `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`, ou
   `AWS_REGION`, `S3_BUCKET`, `AWS_ACCESS_KEY_ID` e `AWS_SECRET_ACCESS_KEY`, todas com `sync: false` no `render.yaml`.
5. **CSP**: incluir o host das fotos em `img-src` e em `connect-src` (o navegador envia direto para ele) no
   `frontend/next.config.ts`, e o host em `images.remotePatterns`.
6. **Limpeza**: um job que apague as fotos enviadas há mais de um dia que não entraram em nenhum anúncio.
7. **Backup e LGPD**: versionamento do bucket (§8.1) e remoção das fotos quando a conta da vendedora for excluída.
