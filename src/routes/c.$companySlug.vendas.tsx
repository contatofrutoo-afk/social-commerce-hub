import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { companyRepository } from "@/repositories";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MesasView, LojaView } from "@/components/atendimento-views";

export const Route = createFileRoute("/c/$companySlug/vendas")({
  component: VendasPage,
});

function VendasPage() {
  const { companySlug } = Route.useParams();

  const { data: company, isLoading } = useQuery({
    queryKey: ["company", companySlug],
    queryFn: () => companyRepository.findBySlug(companySlug),
    staleTime: 30_000,
  });

  if (isLoading) {
    return <div className="p-8 text-center">Carregando...</div>;
  }

  if (!company) {
    return <div className="p-8 text-center">Estabelecimento não encontrado</div>;
  }

  return (
    <div className="space-y-4 p-4">
      <div>
        <h1 className="text-2xl font-bold">Painel de Vendas</h1>
        <p className="text-sm text-muted-foreground">{company.name}</p>
      </div>
      <Tabs defaultValue="mesas">
        <TabsList>
          <TabsTrigger value="mesas">Mesas</TabsTrigger>
          <TabsTrigger value="loja">Loja</TabsTrigger>
        </TabsList>
        <TabsContent value="mesas"><MesasView companyId={company.id} /></TabsContent>
        <TabsContent value="loja"><LojaView companyId={company.id} /></TabsContent>
      </Tabs>
    </div>
  );
}
