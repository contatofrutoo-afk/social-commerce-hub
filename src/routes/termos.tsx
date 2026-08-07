import { createFileRoute } from "@tanstack/react-router";
import { ScrollText } from "lucide-react";
import { LegalPage } from "@/components/legal-page";
import { TERMS_SECTIONS } from "@/lib/legal";

export const Route = createFileRoute("/termos")({
  component: TermsPage,
  head: () => ({
    meta: [
      { title: "Termos de Uso — weaze" },
      {
        name: "description",
        content:
          "Regras de uso da weaze: cadastro, planos, catálogo, pedidos, solicitações, agendamentos, condutas proibidas e responsabilidades.",
      },
      { property: "og:title", content: "Termos de Uso — weaze" },
      {
        property: "og:description",
        content:
          "As regras que organizam a relação entre weaze, estabelecimentos e clientes no ambiente de autoatendimento.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function TermsPage() {
  return (
    <LegalPage
      eyebrow="Termos e condições"
      title="Termos de Uso"
      intro="As regras que organizam o uso da weaze pelos estabelecimentos parceiros e pelos clientes que acessam seu ambiente digital de autoatendimento — escritas a partir das funcionalidades que a plataforma realmente possui."
      icon={ScrollText}
      sections={TERMS_SECTIONS}
    />
  );
}
