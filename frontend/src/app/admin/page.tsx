"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { Painel } from "@/components/admin/Painel";
import { ButtonLink } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { renovarSessao } from "@/lib/api/contas";
import { ROUTES } from "@/lib/routes";
import { useSessao } from "@/lib/sessao";

/**
 * Painel da administração (Módulo 05). Rota privada: sem sessão vai para o login; quem não é
 * a administradora master vê "acesso restrito". Isso só esconde a tela: quem barra de verdade
 * é o backend, que responde 403 em todas as rotas do painel.
 */
export default function AdminPage() {
  const router = useRouter();
  const sessao = useSessao((s) => s.sessao);
  const definir = useSessao((s) => s.definir);
  const jaTentou = useRef(false);

  useEffect(() => {
    if (sessao || jaTentou.current) return;
    jaTentou.current = true;
    renovarSessao()
      .then(definir)
      .catch(() => router.replace(ROUTES.entrar));
  }, [sessao, definir, router]);

  if (!sessao) {
    return (
      <p role="status" className="min-h-[60vh] px-4 py-24 text-center text-roxo-soft">
        carregando o painel…
      </p>
    );
  }

  if (sessao.usuario.perfil !== "ADMIN_MASTER") {
    return (
      <section className="bg-dots">
        <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 lg:py-20">
          <SectionHeading eyebrow="painel da administração">
            acesso <span className="text-violeta italic">restrito</span>
          </SectionHeading>
          <p className="mt-6 text-lg text-roxo-soft">esta área é só da administração do desaPego.</p>
          <ButtonLink href={ROUTES.conta} variant="violeta" size="lg" className="mt-10">
            voltar pra minha conta
          </ButtonLink>
        </div>
      </section>
    );
  }

  return <Painel />;
}
