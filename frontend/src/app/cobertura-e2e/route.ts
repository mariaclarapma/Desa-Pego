/**
 * Cobertura do código que roda no servidor do Next.js (páginas renderizadas no servidor e
 * server actions), lida pelo @cypress/code-coverage no fim dos testes E2E.
 * Só existe no build de cobertura (COBERTURA=1); em qualquer outro caso responde 404.
 */
export const dynamic = "force-dynamic";

export function GET() {
  if (process.env.COBERTURA !== "1") return new Response("não encontrado", { status: 404 });
  return Response.json({ coverage: (globalThis as { __coverage__?: unknown }).__coverage__ ?? null });
}
