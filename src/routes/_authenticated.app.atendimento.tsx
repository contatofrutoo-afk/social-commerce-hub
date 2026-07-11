import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MesasView, LojaView } from "@/components/atendimento-views";

export const Route = createFileRoute("/_authenticated/app/atendimento")({
  component: ServicePage,
  head: () => ({ meta: [{ title: "Atendimento — WEAZE" }] }),
});

function ServicePage() {
  const { data: companyId } = useQuery({
    queryKey: ["my-company-id"],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("company_id")
        .limit(1)
        .maybeSingle();
      return data?.company_id as string | undefined;
    },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Atendimento</h1>
      <Tabs defaultValue="mesas">
        <TabsList>
          <TabsTrigger value="mesas">Mesas</TabsTrigger>
          <TabsTrigger value="loja">Loja</TabsTrigger>
        </TabsList>
        <TabsContent value="mesas">{companyId && <MesasView companyId={companyId} />}</TabsContent>
        <TabsContent value="loja">{companyId && <LojaView companyId={companyId} />}</TabsContent>
      </Tabs>
    </div>
  );
}
