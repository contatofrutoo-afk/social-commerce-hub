import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { companyRepository } from "@/repositories";
import { onboardViaQr } from "@/lib/qr-onboard";
import { Logo } from "@/components/logo";
import { Loader2, Store } from "lucide-react";

export const Route = createFileRoute("/c/$companySlug/")({
  component: CheckinPage,
});

function CheckinPage() {
  const { companySlug } = Route.useParams();
  const navigate = useNavigate();
  const router = useRouter();
  const onboardedRef = useRef(false);

  const { data: company, isLoading } = useQuery({
    queryKey: ["company", companySlug],
    queryFn: () => companyRepository.findBySlug(companySlug),
    staleTime: 30_000,
  });

  // Jornada sem cadastro: cria a sessão em segundo plano (anônima ou reaproveitando
  // perfil salvo) e leva direto ao Feed Catálogo. Nenhum formulário é exibido.
  useEffect(() => {
    if (!company) return;
    if (onboardedRef.current) return;
    onboardedRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const tableId = params.get("t") ?? params.get("table") ?? "";

    (async () => {
      try {
        await onboardViaQr({
          companyId: company.id,
          companySlug,
          tableId: tableId || null,
          source: tableId ? "mesa" : "link",
        });
      } catch (err) {
        console.warn("[qr_onboard]", err instanceof Error ? err.message : err);
      } finally {
        await router.preloadRoute({ to: "/c/$companySlug/feed", params: { companySlug } });
        navigate({ to: "/c/$companySlug/feed", params: { companySlug } });
      }
    })();
  }, [company, companySlug, navigate, router]);

  if (!isLoading && !company) {
    return (
      <div className="weaze-hero-gradient min-h-screen px-6 py-10">
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

  return (
    <div className="weaze-hero-gradient min-h-screen px-6 py-10">
      <div className="mx-auto flex max-w-md flex-col items-center justify-center pt-20 text-center">
        {company?.logoUrl ? (
          <img
            src={company.logoUrl}
            alt={company.name}
            className="mx-auto size-20 rounded-2xl object-cover shadow-elegant ring-1 ring-border"
          />
        ) : (
          <div className="mx-auto grid size-20 place-items-center rounded-2xl bg-card shadow-elegant ring-1 ring-border">
            <Logo className="h-10" />
          </div>
        )}
        <Loader2 className="mt-8 size-6 animate-spin text-primary" />
        <p className="mt-3 text-sm text-muted-foreground">Abrindo o catálogo…</p>
      </div>
    </div>
  );
}
