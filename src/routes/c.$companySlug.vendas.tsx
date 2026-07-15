import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { companyRepository } from "@/repositories";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MesasView, LojaView } from "@/components/atendimento-views";

export const Route = createFileRoute("/c/$companySlug/vendas")({
  component: VendasPage,
  head: () => ({ meta: [{ title: "Painel de Vendas — WEAZE" }] }),
});

function VendasPage() {
  const { companySlug } = Route.useParams();

  const { data: company, isError } = useQuery({
    queryKey: ["company", companySlug],
    queryFn: () => companyRepository.findBySlug(companySlug),
    staleTime: 30_000,
    retry: 1,
  });

  if (isError) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Erro ao carregar estabelecimento.</div>;
  }

  return (
    <div className="space-y-4 p-4">
      <div>
        <h1 className="text-2xl font-bold">Painel de Vendas</h1>
        <p className="text-sm text-muted-foreground">{company?.name ?? "Carregando..."}</p>
      </div>
      {company ? (
        <Tabs defaultValue="mesas">
          <TabsList>
            <TabsTrigger value="mesas">Mesas</TabsTrigger>
            <TabsTrigger value="loja">Loja</TabsTrigger>
          </TabsList>
          <TabsContent value="mesas">
            <MesasView companyId={company.id} />
          </TabsContent>
          <TabsContent value="loja">
            <LojaView companyId={company.id} />
          </TabsContent>
        </Tabs>
      ) : (
        <p className="text-sm text-muted-foreground">Carregando painel...</p>
      )}
    </div>
  );
}
