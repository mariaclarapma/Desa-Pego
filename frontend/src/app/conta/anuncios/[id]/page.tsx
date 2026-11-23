"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AvisoChavePix } from "@/components/anuncios/AvisoChavePix";
import { FormularioAnuncio } from "@/components/anuncios/FormularioAnuncio";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { anuncios, type Anuncio } from "@/lib/api/anuncios";
import { tokenTemChavePix } from "@/lib/chavePix";
import { ROUTES } from "@/lib/routes";
import { useChamadaAutenticada } from "@/lib/useChamadaAutenticada";
import { useSessaoObrigatoria } from "@/lib/useSessaoObrigatoria";

/** Editar anúncio (Req. 004). O backend recusa se a peça estiver num pedido ou for de outra pessoa. */
export default function EditarAnuncioPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const sessao = useSessaoObrigatoria();
  const chamar = useChamadaAutenticada();
  const [anuncio, setAnuncio] = useState<Anuncio | null>(null);
  const [erro, setErro] = useState("");
  // carrega uma vez só: `chamar` muda quando o token é renovado, e isso não deve recarregar o formulário
  const carregado = useRef(false);

  useEffect(() => {
    if (!sessao || carregado.current) return;
    carregado.current = true;
    chamar((token) => anuncios.ler(token, id)).then(setAnuncio, (falha: Error) => setErro(falha.message));
  }, [sessao, id, chamar]);

  const bloqueado = anuncio && (anuncio.status !== "disponivel" || anuncio.emPedido);

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:py-16">
      <Link href={ROUTES.meusAnuncios} className="text-sm text-roxo-soft underline-offset-4 hover:text-violeta hover:underline">
        voltar para meus anúncios
      </Link>
      <div className="mt-4">
        <SectionHeading>editar anúncio</SectionHeading>
      </div>
      <div className="mt-10">
        {erro ? (
          <p role="alert" className="text-magenta">
            {erro}
          </p>
        ) : !sessao || !anuncio ? (
          <p role="status" className="text-roxo-soft">
            carregando…
          </p>
        ) : bloqueado ? (
          <p className="rounded-2xl border-2 border-roxo bg-lilas-100 p-4">
            esta peça está {anuncio.status === "vendida" ? "vendida" : "num pedido"} e não pode ser editada.
          </p>
        ) : !tokenTemChavePix(sessao.accessToken) ? (
          <AvisoChavePix />
        ) : (
          <FormularioAnuncio
            inicial={anuncio}
            chamar={chamar}
            textoBotao="salvar alterações"
            textoEnviando="salvando…"
            aoSalvar={async (dados) => {
              await chamar((token) => anuncios.editar(token, anuncio.id, dados));
              router.push(`${ROUTES.meusAnuncios}?aviso=editado`);
            }}
          />
        )}
      </div>
    </div>
  );
}
