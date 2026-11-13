# @desapego/web — frontend do desaPego

Next.js 15 (App Router) + TypeScript + Tailwind CSS v4, conforme o [Documento de Arquitetura](../../docs/ARQUITETURA.md).

```bash
cd apps/web
npm install
npm run dev        # http://localhost:3000
npm test           # Vitest + Testing Library
npm run lint
npm run typecheck
npm run build
```

## Organização

| Pasta | Conteúdo |
| --- | --- |
| `src/app` | rotas (Home em `page.tsx`, 404 amigável em `not-found.tsx`), layout e tokens de marca (`globals.css`) |
| `src/components/ui` | peças base: `Button`, `Sticker`, `ConditionBadge` (selos do Req. 004), `SectionHeading`, ícones SVG |
| `src/components/layout` | `SiteHeader` (busca, categorias, menu mobile), `SiteFooter` |
| `src/components/catalogo` | `ProductCard` e `FavoriteButton`, reaproveitáveis na vitrine do Req. 007 |
| `src/components/home` | seções da Home |
| `src/lib` | `routes.ts` (todas as URLs) e `format.ts` (preço em centavos → BRL) |
| `src/data/demo` | ⚠️ **dados e fotos de demonstração**; substituir pela API do catálogo |

## Identidade visual

- **Cores** (tokens Tailwind): `creme` fundo · `vinho` texto · `cereja` ação · `chiclete`, `lilas`, `pessego` apoio.
- **Tipos:** Fraunces (títulos, itálico expressivo) · DM Sans (interface) · Caveat (adesivos e anotações).
- **Linguagem:** contorno vinho de 2px + sombra sólida deslocada ("adesivo"), recortes em arco, fita adesiva, colagens.
- O logotipo é sempre escrito **desaPego**.

## Fotos de demonstração

Vêm do Unsplash (`src/data/demo/imagens.ts` e `catalogo.ts`). Para trocar, edite o ID ou aponte para um arquivo em `/public`.
Quando as fotos vierem do S3/CDN, adicione o host em `next.config.ts` → `images.remotePatterns`.
