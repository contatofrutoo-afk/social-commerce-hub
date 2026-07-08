import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/weaze/licencas")({
  component: WeazeLicencas,
  head: () => ({ meta: [{ title: "Licenças — WEAZE Admin" }] }),
});

function WeazeLicencas() {
  const [loading, setLoading] = useState(true);
  const [licenses, setLicenses] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await supabase.from("company_licenses").select("*, company:companies(name)").order("created_at", { ascending: false });
        setLicenses(data ?? []);
      } catch { /* table may not exist */ }
      setLoading(false);
    })();
  }, []);

  const statusColor = (s: string) =>
    s === "active" ? "default" : s === "expired" ? "destructive" : "outline";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Licenças</h1>
        <p className="text-muted-foreground text-sm mt-1">Histórico de licenças e contratos.</p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : licenses.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <FileText className="mx-auto h-8 w-8 mb-2 opacity-40" />
            <p>Nenhuma licença encontrada.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {licenses.map((l: any) => (
            <Card key={l.id}>
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <h3 className="font-medium">{l.company?.name ?? "—"}</h3>
                  <p className="text-sm text-muted-foreground">{l.plan_type} · R$ {Number(l.monthly_fee).toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">
                    {l.start_date ? new Date(l.start_date).toLocaleDateString("pt-BR") : "—"}
                    {l.end_date ? ` até ${new Date(l.end_date).toLocaleDateString("pt-BR")}` : ""}
                  </p>
                </div>
                <Badge variant={statusColor(l.status) as any}>
                  {l.status === "active" ? "Ativa" : l.status === "expired" ? "Expirada" : "Cancelada"}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
