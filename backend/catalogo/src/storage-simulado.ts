import { randomBytes } from "node:crypto";
import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";

/**
 * Supabase Storage simulado (só para testes): as mesmas rotas que o ArmazenamentoSupabase usa, com
 * as regras que os buckets terão no projeto (docs/FOTOS.md):
 * - envio por URL assinada, só no caminho assinado e sem sobrescrever;
 * - bucket de envios privado, com tipos aceitos e limite de tamanho;
 * - bucket de fotos público para leitura.
 * Não substitui o teste no Supabase de verdade (veja "o que falta validar" em docs/FOTOS.md).
 */
export interface BucketSimulado {
  publico: boolean;
  tiposAceitos?: string[];
  limiteBytes?: number;
}

interface Objeto {
  dados: Buffer;
  tipo: string;
}

export class StorageSimulado {
  readonly objetos = new Map<string, Objeto>();
  readonly chamadas: string[] = [];
  private tokens = new Map<string, string>();
  private servidor: Server | null = null;
  url = "";

  constructor(
    private chave: string,
    private buckets: Record<string, BucketSimulado>,
  ) {}

  async iniciar() {
    this.servidor = createServer((req, res) => {
      this.atender(req)
        .then(({ status, corpo, cabecalhos }) => {
          res.writeHead(status, cabecalhos);
          res.end(corpo);
        })
        .catch(() => {
          res.writeHead(500);
          res.end();
        });
    });
    await new Promise<void>((ok) => this.servidor!.listen(0, "127.0.0.1", ok));
    this.url = `http://127.0.0.1:${(this.servidor!.address() as AddressInfo).port}`;
    return this;
  }

  parar() {
    return new Promise<void>((ok) => (this.servidor ? this.servidor.close(() => ok()) : ok()));
  }

  private autorizado(req: IncomingMessage) {
    return req.headers.apikey === this.chave && req.headers.authorization === `Bearer ${this.chave}`;
  }

  private async ler(req: IncomingMessage) {
    const partes: Buffer[] = [];
    for await (const parte of req) partes.push(parte as Buffer);
    return Buffer.concat(partes);
  }

  private async atender(req: IncomingMessage): Promise<{ status: number; corpo?: Buffer | string; cabecalhos?: Record<string, string> }> {
    const url = new URL(req.url ?? "/", "http://x");
    const caminho = decodeURIComponent(url.pathname.replace(/^\/storage\/v1/, ""));
    this.chamadas.push(`${req.method} ${caminho}`);
    const json = (status: number, dados: unknown) => ({ status, corpo: JSON.stringify(dados), cabecalhos: { "Content-Type": "application/json" } });
    const naoEncontrado = json(400, { statusCode: "404", error: "not_found", message: "Object not found" });
    const separar = (resto: string) => {
      const [bucket, ...k] = resto.split("/");
      return { bucket, chave: k.join("/") };
    };

    let m = /^\/object\/upload\/sign\/(.+)$/.exec(caminho);
    if (m && req.method === "POST") {
      if (!this.autorizado(req)) return json(403, { message: "unauthorized" });
      const token = randomBytes(12).toString("hex");
      this.tokens.set(token, m[1]);
      return json(200, { url: `/object/upload/sign/${m[1]}?token=${token}` });
    }
    if (m && req.method === "PUT") {
      const alvo = m[1];
      if (this.tokens.get(url.searchParams.get("token") ?? "") !== alvo) return json(400, { message: "invalid signature" });
      const { bucket } = separar(alvo);
      const regras = this.buckets[bucket];
      const tipo = String(req.headers["content-type"] ?? "").split(";")[0];
      const dados = await this.ler(req);
      if (this.objetos.has(alvo)) return json(409, { error: "Duplicate", message: "The resource already exists" });
      if (regras?.tiposAceitos && !regras.tiposAceitos.includes(tipo)) return json(415, { error: "invalid_mime_type" });
      if (regras?.limiteBytes && dados.length > regras.limiteBytes) return json(413, { error: "Payload too large" });
      this.objetos.set(alvo, { dados, tipo });
      return json(200, { Key: alvo });
    }

    m = /^\/object\/authenticated\/(.+)$/.exec(caminho);
    if (m && req.method === "GET") {
      if (!this.autorizado(req)) return json(403, { message: "unauthorized" });
      const obj = this.objetos.get(m[1]);
      if (!obj) return naoEncontrado;
      const faixa = /^bytes=(\d+)-(\d+)$/.exec(String(req.headers.range ?? ""));
      if (!faixa) return { status: 200, corpo: obj.dados, cabecalhos: { "Content-Type": obj.tipo } };
      const fim = Math.min(Number(faixa[2]), obj.dados.length - 1);
      return {
        status: 206,
        corpo: obj.dados.subarray(Number(faixa[1]), fim + 1),
        cabecalhos: { "Content-Type": obj.tipo, "Content-Range": `bytes ${faixa[1]}-${fim}/${obj.dados.length}` },
      };
    }

    m = /^\/object\/public\/(.+)$/.exec(caminho);
    if (m && req.method === "GET") {
      const { bucket } = separar(m[1]);
      const obj = this.objetos.get(m[1]);
      if (!this.buckets[bucket]?.publico || !obj) return naoEncontrado;
      return { status: 200, corpo: obj.dados, cabecalhos: { "Content-Type": obj.tipo } };
    }

    if (caminho === "/object/copy" && req.method === "POST") {
      if (!this.autorizado(req)) return json(403, { message: "unauthorized" });
      const { bucketId, sourceKey, destinationBucket, destinationKey } = JSON.parse((await this.ler(req)).toString());
      const obj = this.objetos.get(`${bucketId}/${sourceKey}`);
      if (!obj) return naoEncontrado;
      const destino = `${destinationBucket ?? bucketId}/${destinationKey}`;
      if (this.objetos.has(destino) && req.headers["x-upsert"] !== "true") return json(409, { error: "Duplicate" });
      this.objetos.set(destino, { ...obj });
      return json(200, { Key: destino });
    }

    m = /^\/object\/([^/]+)\/(.+)$/.exec(caminho);
    if (m && req.method === "POST" && !["upload", "authenticated", "public", "copy"].includes(m[1])) {
      if (!this.autorizado(req)) return json(403, { message: "unauthorized" });
      const alvo = `${m[1]}/${m[2]}`;
      const dados = await this.ler(req);
      if (this.objetos.has(alvo) && req.headers["x-upsert"] !== "true") return json(409, { error: "Duplicate" });
      this.objetos.set(alvo, { dados, tipo: String(req.headers["content-type"] ?? "") });
      return json(200, { Key: alvo });
    }

    m = /^\/object\/([^/]+)$/.exec(caminho);
    if (m && req.method === "DELETE") {
      if (!this.autorizado(req)) return json(403, { message: "unauthorized" });
      const { prefixes } = JSON.parse((await this.ler(req)).toString()) as { prefixes: string[] };
      const apagados = prefixes.filter((p) => this.objetos.delete(`${m![1]}/${p}`));
      return json(200, apagados.map((name) => ({ name })));
    }

    return json(404, { message: "rota não simulada" });
  }
}
