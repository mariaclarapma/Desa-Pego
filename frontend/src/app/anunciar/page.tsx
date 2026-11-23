"use client";

import { useRouter } from "next/navigation";
import { AvisoChavePix } from "@/components/anuncios/AvisoChavePix";
import { FormularioAnuncio } from "@/components/anuncios/FormularioAnuncio";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { anuncios } from "@/lib/api/anuncios";
import { tokenTemChavePix } from "@/lib/chavePix";
import { ROUTES } from "@/lib/routes";
import { useChamadaAutenticada } from "@/lib/useChamadaAutenticada";
import { useSessaoObrigatoria } from "@/lib/useSessaoObrigatoria";

/** Publicar anúncio (Req. 004) com o simulador de ganho (Req. 005). Exige login e chave Pix. */
export default function AnunciarPage() {
  const router = useRouter();
  const sessao = useSessaoObrigatoria();
  const chamar = useChamadaAutenticada();

  if (!sessao) {
    return (
      <p role="status" className="min-h-[60vh] px-4 py-24 text-center text-roxo-soft">
        carregando…
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:py-16">
      <SectionHeading>anunciar uma peça</SectionHeading>
      <p className="mt-4 max-w-xl text-roxo-soft">fotos boas e uma descrição honesta ajudam a peça a sair mais rápido.</p>
      <div className="mt-10">
        {tokenTemChavePix(sessao.accessToken) ? (
          <FormularioAnuncio
            chamar={chamar}
            textoBotao="publicar anúncio"
            textoEnviando="publicando…"
            aoSalvar={async (dados) => {
              await chamar((token) => anuncios.publicar(token, dados));
              router.push(`${ROUTES.meusAnuncios}?aviso=publicado`);
            }}
          />
        ) : (
          <AvisoChavePix />
        )}
      </div>
    </div>
  );
}
