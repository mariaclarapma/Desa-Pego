// Produção: os três serviços (contas, catálogo e pedidos) no mesmo processo `node`. Cada um continua
// sendo um app Express separado, na sua própria porta e com as suas próprias conexões com o banco;
// só deixam de pagar, cada um, o custo de um Node inteiro (~50 MB) no plano grátis do Render.
// Rode `npm run build -w backend` antes (gera os arquivos em */dist/).
await import("./contas/dist/servidor.js");
await import("./catalogo/dist/servidor.js");
await import("./pedidos/dist/servidor.js");
