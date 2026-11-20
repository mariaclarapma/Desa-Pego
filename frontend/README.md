# frontend — desaPego

Next.js 15 (App Router) + TypeScript + Tailwind CSS v4, conforme o [Documento de Arquitetura](../docs/ARQUITETURA.md).

Feito pela Clarice Nunes (Home, identidade visual e componentes base) e ampliado com a vitrine,
a página da peça, a sacola com reserva, o checkout e o pedido com Pix.

Os comandos abaixo rodam dentro de `frontend/`. Na raiz do repositório, `npm run dev` sobe o
frontend junto com o [backend](../backend/README.md), que o frontend precisa para listar as peças.

```bash
npm install
npm run dev        # http://localhost:3000 (precisa do backend em http://localhost:3001)
npm test           # Vitest + Testing Library
npm run lint
npm run typecheck
npm run build
```

## Organização

| Pasta | Conteúdo |
| --- | --- |
| `src/app` | rotas (Home em `page.tsx`, 404 amigável em `not-found.tsx`), layout e tokens de marca (`globals.css`) |
| `src/app/catalogo` | vitrine com busca sem acento, filtros e ordenação na URL (Req. 007) |
| `src/app/peca/[id]` | página da peça, com status lido da API a cada acesso (Req. 008) |
| `src/app/carrinho` | sacola com a contagem regressiva da reserva de 15 min (Req. 010) |
| `src/app/checkout` e `src/app/pedido/[id]` | endereço pelo ViaCEP, frete fixo e Pix simulado (Req. 011) |
| `src/app/entrar` e `src/app/cadastro` | login e cadastro na mesma tela, alternando sem recarregar (Req. 001) |
| `src/app/conta` | área da conta: recupera a sessão pelo cookie e permite sair |
| `src/components/conta` | `PaginaConta` (layout em duas áreas, abas, envio) e `CampoConta` (rótulo, dica, erro e mostrar senha) |
| `src/components/sacola` | botão de reservar, contador e selo de quantidade no cabeçalho |
| `src/lib/api` | acesso à API REST do backend (`catalogo.ts`, `pedidos.ts`) |
| `src/lib/sacola.ts` | estado da sacola (Zustand, salvo no navegador) |
| `src/components/ui` | peças base: `Button`, `Sticker`, `ConditionBadge` (selos do Req. 004), `SectionHeading`, ícones SVG |
| `src/components/layout` | `SiteHeader` (busca, categorias, menu mobile), `SiteFooter` |
| `src/components/catalogo` | `ProductCard` e `FavoriteButton`, reaproveitáveis na vitrine do Req. 007 |
| `src/components/home` | seções da Home |
| `src/lib` | `routes.ts` (todas as URLs) e `format.ts` (preço em centavos → BRL) |
| `src/data/demo` | ⚠️ **dados e fotos de demonstração** usados pela Home; as demais páginas já leem da API |

## Identidade visual

- **Cores do CEUB** (tokens Tailwind em `src/app/globals.css`): `nevoa` fundo · `roxo` texto e contornos
  (roxo institucional `#4a1259`) · `violeta` ação e preço · `rosa` e `magenta` destaque (das linhas da marca CEUB) ·
  `lilas` e `pervinca` apoio. Use sempre os tokens, nunca cores soltas.
- **Temas:** claro, escuro e alto contraste usam os mesmos tokens com outros valores (`<html data-tema="...">`).
  Por padrão o site segue o tema do sistema; a pessoa pode trocar no cabeçalho ou na barra de acessibilidade.
- **Contraste:** todas as combinações de texto passam no WCAG 2.1 AA nos 3 temas (texto ≥ 4,5:1, contornos e foco ≥ 3:1).
- **Tipos:** Fraunces (títulos, itálico expressivo) · DM Sans (interface) · Caveat (adesivos e anotações).
- **Linguagem:** contorno roxo de 2px + sombra sólida deslocada ("adesivo"), recortes em arco, fita adesiva, colagens.
  Identidade criada pela Clarice; as cores passaram do vinho/cereja para o roxo e lilás do CEUB.
- O logotipo é sempre escrito **desaPego**.

## Acessibilidade

- **Barra de acessibilidade** (`src/components/acessibilidade`), no padrão dos sites gov.br: na lateral esquerda
  (no celular, no canto inferior), com três botões:
  - **Libras:** abre o [VLibras](https://www.gov.br/governodigital/pt-br/vlibras), tradutor oficial do governo
    federal. O script só é carregado quando a pessoa clica (precisa de internet).
  - **Leitor de voz:** lê em voz alta o texto selecionado ou, sem seleção, o conteúdo principal da página
    (Web Speech API do navegador, voz em português).
  - **Opções visuais:** tema (claro, escuro, do sistema), alto contraste e tamanho da fonte (90% a 150%).
- As preferências ficam salvas no navegador e são aplicadas antes da primeira pintura, sem "piscar".
- Anel de foco visível em todos os temas, menu e painel fecham com Esc e devolvem o foco, e as animações
  respeitam `prefers-reduced-motion`.

## Login e cadastro

- Validação no navegador (`src/lib/validacao-conta.ts`): nome e sobrenome, e-mail, senha com no mínimo 8
  caracteres com letra e número, e confirmação igual. O backend deve validar de novo.
- As chamadas vão para `/api/auth/login` e `/api/auth/cadastro`, na mesma origem (proxy em `next.config.ts`),
  para o refresh token ficar num cookie httpOnly first-party.
- O login é real, feito pelo [serviço de contas](../backend/README.md#serviço-de-contas-contas). A sessão fica só na
  memória (`src/lib/sessao.ts`) e volta pelo cookie httpOnly ao recarregar. Se o serviço não responder, a tela avisa
  e não finge que entrou.
- Mensagem genérica para credenciais inválidas (não revela se o e-mail existe).

## Fotos de demonstração

Vêm do Unsplash (`src/data/demo/imagens.ts` e `catalogo.ts`). Para trocar, edite o ID ou aponte para um arquivo em `/public`.
Quando as fotos vierem do S3/CDN, adicione o host em `next.config.ts` → `images.remotePatterns`.
