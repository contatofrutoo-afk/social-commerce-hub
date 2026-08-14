import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { companyRepository, postRepository } from "@/repositories";
import { onboardViaQr } from "@/lib/qr-onboard";
import { hasConsent } from "@/lib/consent";
import { PostCardSkeleton } from "@/components/post-card-skeleton";
import { ConsentScreen } from "@/components/consent-screen";
import { Store } from "lucide-react";

export const Route = createFileRoute("/c/$companySlug/")({
  // Carregado no servidor para que o preview do link (WhatsApp, Instagram, etc.)
  // mostre o logotipo e o nome do estabelecimento.
  loader: async ({ params }) => {
    try {
      return await companyRepository.findBySlug(params.companySlug);
    } catch {
      return null;
    }
  },
  head: ({ loaderData }) => {
    const company = loaderData ?? null;
    const name = company?.name ?? "Cardápio digital";
    const title = `${name} — Peça pelo celular`;
    const description =
      company?.welcomeMessage ??
      `Acesse o catálogo de ${name}, faça seu pedido pelo celular e acompanhe tudo em tempo real.`;
    const image = company?.logoUrl;
    const isAbsolute = typeof image === "string" && image.startsWith("https://");

    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:site_name", content: name },
        { name: "twitter:card", content: isAbsolute ? "summary_large_image" : "summary" },
        ...(isAbsolute
          ? [
              { property: "og:image", content: image as string },
              { property: "og:image:alt", content: `Logotipo de ${name}` },
              { name: "twitter:image", content: image as string },
            ]
          : []),
      ],
      links: isAbsolute
        ? [{ rel: "icon", href: image as string }]
        : [],
    };
  },
  component: CheckinPage,
});


function CheckinPage() {
  const { companySlug } = Route.useParams();
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();
  const onboardedRef = useRef(false);
  const [consented, setConsented] = useState(() => hasConsent());
  const [entering, setEntering] = useState(false);

  const { data: company, isLoading } = useQuery({
    queryKey: ["company", companySlug],
    queryFn: () => companyRepository.findBySlug(companySlug),
    staleTime: 30_000,
  });

  // Jornada sem cadastro: cria a sessão em segundo plano (anônima ou reaproveitando
  // perfil salvo), pré-carrega o feed e leva direto ao Catálogo sem tela de loading.
  // O onboarding só acontece DEPOIS do consentimento LGPD.
  useEffect(() => {
    if (!company || !consented) return;
    if (onboardedRef.current) return;
    onboardedRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const tableId = params.get("t") ?? params.get("table") ?? "";
    const src = params.get("src") ?? params.get("origem") ?? "";

    (async () => {
      try {
        const session = await onboardViaQr({
          companyId: company.id,
          companySlug,
          tableId: tableId || null,
          source: tableId ? "mesa" : src === "qr" ? "qr" : "link",
        });
        queryClient.setQueryData(["company", companySlug], company);
        await queryClient.prefetchQuery({
          queryKey: ["feed", company.id, session.customerId],
          queryFn: () => postRepository.listByCompany(company.id, session.customerId),
          staleTime: 15_000,
        });
      } catch (err) {
        console.warn("[qr_onboard]", err instanceof Error ? err.message : err);
      } finally {
        await router.preloadRoute({ to: "/c/$companySlug/feed", params: { companySlug } });
        navigate({ to: "/c/$companySlug/feed", params: { companySlug } });
      }
    })();
  }, [company, consented, companySlug, navigate, router, queryClient]);

  if (!isLoading && !company) {
    return (
      <div className="min-h-screen bg-background px-6 py-10">
        <div className="mx-auto max-w-md text-center">
          <Store className="mx-auto size-12 text-muted-foreground" />
          <p className="mt-4 font-display text-lg font-semibold">Estabelecimento não encontrado</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Verifique o link ou entre em contato com o estabelecimento.
          </p>
        </div>
      </div>
    );
  }

  if (!consented) {
    return (
      <ConsentScreen
        onAccepted={() => {
          setConsented(true);
          setEntering(true);
        }}
      />
    );
  }

  // Após aceitar, mantém a tela de consentimento estável enquanto o onboarding
  // roda em segundo plano — evita o flicker de skeleton antes da navegação.
  if (entering) {
    return <ConsentScreen busy onAccepted={() => {}} />;
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="space-y-4 p-4">
        <PostCardSkeleton />
        <PostCardSkeleton />
        <PostCardSkeleton />
      </div>
    </div>
  );
}
