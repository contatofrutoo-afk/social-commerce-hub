import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { LegalPage } from "@/components/legal-page";
import { PRIVACY_SECTIONS } from "@/lib/legal";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
  head: () => ({
    meta: [
      { title: "Política de Privacidade — weaze" },
      {
        name: "description",
        content:
          "Como a weaze coleta, usa e protege os dados de clientes e estabelecimentos, em conformidade com a LGPD.",
      },
      { property: "og:title", content: "Política de Privacidade — weaze" },
      {
        property: "og:description",
        content: "Transparência total sobre dados, IA, cookies e seus direitos como titular.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Privacidade e LGPD"
      title="Política de Privacidade"
      intro="Explicamos, sem juridiquês desnecessário, quais dados a weaze trata em cada área da plataforma, por que trata, com quem compartilha e como você controla tudo isso."
      icon={ShieldCheck}
      sections={PRIVACY_SECTIONS}
    />
  );
}
