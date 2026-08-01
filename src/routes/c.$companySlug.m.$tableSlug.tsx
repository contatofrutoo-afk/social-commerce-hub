import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { companyRepository, tableRepository, postRepository } from "@/repositories";
import { onboardViaQr } from "@/lib/qr-onboard";
import { hasConsent } from "@/lib/consent";
import { PostCardSkeleton } from "@/components/post-card-skeleton";
import { ConsentScreen } from "@/components/consent-screen";

export const Route = createFileRoute("/c/$companySlug/m/$tableSlug")({
  component: TableCheckin,
});

function TableCheckin() {
  const { companySlug, tableSlug } = Route.useParams();
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();
  const onboardedRef = useRef(false);
  const [consented, setConsented] = useState(() => hasConsent());

  const { data: company } = useQuery({
    queryKey: ["company", companySlug],
    queryFn: () => companyRepository.findBySlug(companySlug),
    staleTime: 30_000,
  });

  const {
    data: table,
    isLoading: tableLoading,
    error: tableError,
  } = useQuery({
    queryKey: ["table", company?.id, tableSlug],
    queryFn: () => (company ? tableRepository.findBySlug(company.id, tableSlug) : null),
    enabled: !!company,
    staleTime: 30_000,
  });

  // Jornada sem cadastro: cria a sessão em segundo plano (anônima ou reaproveitando
  // perfil salvo), pré-carrega o feed e leva direto ao Catálogo sem tela de loading.
  // O onboarding só acontece DEPOIS do consentimento LGPD.
  useEffect(() => {
    if (!company || !table || !consented) return;
    if (onboardedRef.current) return;
    onboardedRef.current = true;

    (async () => {
      try {
        const session = await onboardViaQr({
          companyId: company.id,
          companySlug,
          tableId: table.id,
          source: `mesa-${table.slug}`,
        });
        queryClient.setQueryData(["company", companySlug], company);
        await queryClient.prefetchQuery({
          queryKey: ["feed", company.id, session.customerId],
          queryFn: () => postRepository.listByCompany(company.id, session.customerId),
          staleTime: 15_000,
        });
      } catch (err) {
        console.warn("[qr_onboard_mesa]", err instanceof Error ? err.message : err);
      } finally {
        await router.preloadRoute({ to: "/c/$companySlug/feed", params: { companySlug } });
        navigate({ to: "/c/$companySlug/feed", params: { companySlug } });
      }
    })();
  }, [company, table, consented, companySlug, navigate, router, queryClient]);

  if (tableError) {
    console.warn("[mesa_checkin] table query error:", tableError.message);
    return (
      <div className="px-6 py-8 text-center space-y-3">
        <p className="text-destructive font-medium">Mesa não encontrada</p>
        <p className="text-sm text-muted-foreground">
          Verifique o link ou entre em contato com o estabelecimento.
        </p>
      </div>
    );
  }
  if (company && !tableLoading && table === null) {
    return (
      <div className="px-6 py-8 text-center space-y-3">
        <p className="text-destructive font-medium">Mesa "{tableSlug}" não encontrada</p>
        <p className="text-sm text-muted-foreground">
          Esta mesa não existe em {company.name}. Verifique o link.
        </p>
      </div>
    );
  }
  if (!company || !table) {
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

  if (!consented) {
    return <ConsentScreen onAccepted={() => setConsented(true)} />;
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
