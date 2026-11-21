import { fileURLToPath } from "node:url";
import { lerSegredoJwt } from "../../comum/autenticacao.js";
import { carregarEnv, lerLista, lerOrigens, lerTrustProxy } from "../../comum/seguranca.js";
import { criarAppPedidos } from "./app.js";
import { abrirBancoPedidos } from "./banco.js";

// .env da raiz do repositório (fora do Git), se existir. Na hospedagem as variáveis vêm do painel.
carregarEnv(fileURLToPath(new URL("../../../.env", import.meta.url)));

const porta = Number(process.env.PORTA_PEDIDOS ?? 3003);
const url = process.env.DATABASE_URL || undefined;
if (process.env.NODE_ENV === "production" && !url) throw new Error("DATABASE_URL é obrigatório em produção.");

const banco = await abrirBancoPedidos(url);
const servidor = criarAppPedidos(banco, {
  jwtSegredo: lerSegredoJwt(process.env),
  apiKeys: lerLista(process.env.API_KEYS),
  origens: lerOrigens(process.env),
  trustProxy: lerTrustProxy(process.env.TRUST_PROXY),
}).listen(porta, "127.0.0.1", () => {
  console.log(`[pedidos] pedidos, carteira e admin em http://localhost:${porta}`);
  if (!url) console.warn("[pedidos] DATABASE_URL não definido: banco em memória.");
});

for (const sinal of ["SIGINT", "SIGTERM"] as const) {
  process.on(sinal, () => {
    servidor.close(() => {
      banco.fechar().finally(() => process.exit(0));
    });
  });
}
