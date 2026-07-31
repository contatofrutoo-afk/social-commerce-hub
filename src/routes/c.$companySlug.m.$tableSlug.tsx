import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { companyRepository, tableRepository } from "@/repositories";
import { onboardViaQr } from "@/lib/qr-onboard";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/c/$companySlug/m/$tableSlug")({
  component: TableCheckin,
});

function TableCheckin() {
  const { companySlug, tableSlug } = Route.useParams();
  const navigate = useNavigate();
  const router = useRouter();
  const onboardedRef = useRef(false);

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
  // perfil salvo) e leva direto ao Feed Catálogo. Nenhum formulário é exibido.
  useEffect(() => {
    if (!company || !table) return;
    if (onboardedRef.current) return;
    onboardedRef.current = true;

    (async () => {
      try {
        await onboardViaQr({
          companyId: company.id,
          companySlug,
          tableId: table.id,
          source: `mesa-${table.slug}`,
        });
      } catch (err) {
        console.warn("[qr_onboard_mesa]", err instanceof Error ? err.message : err);
      } finally {
        await router.preloadRoute({ to: "/c/$companySlug/feed", params: { companySlug } });
        navigate({ to: "/c/$companySlug/feed", params: { companySlug } });
      }
    })();
  }, [company, table, companySlug, navigate, router]);

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
      <div className="px-6 py-8">
        <div className="mb-6 text-center space-y-3">
          <Skeleton className="mx-auto h-6 w-24 rounded-full" />
          <Skeleton className="mx-auto h-8 w-64" />
          <Skeleton className="mx-auto h-4 w-32" />
        </div>
        <div className="flex flex-col items-center justify-center pt-8">
          <Loader2 className="size-6 animate-spin text-primary" />
          <p className="mt-3 text-sm text-muted-foreground">Abrindo o catálogo…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-8">
      <div className="mb-6 text-center">
        <div className="inline-block rounded-full bg-primary px-4 py-1 text-sm font-medium text-primary-foreground">
          {table.label}
        </div>
        <h1 className="mt-4 text-2xl font-bold">{company.welcomeMessage}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{company.name}</p>
      </div>
      <div className="flex flex-col items-center justify-center pt-8">
        <Loader2 className="size-6 animate-spin text-primary" />
        <p className="mt-3 text-sm text-muted-foreground">Abrindo o catálogo…</p>
      </div>
    </div>
  );
}
