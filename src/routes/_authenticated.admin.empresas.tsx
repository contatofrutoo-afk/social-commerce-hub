import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Building2, Search, Ban, CheckCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/empresas")({
  component: WeazeEmpresas,
  head: () => ({ meta: [{ title: "Empresas — WEAZE Admin" }] }),
});

function WeazeEmpresas() {
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [companies, setCompanies] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data: adminRows } = await supabase.from("company_admin").select("*, company:companies(name, slug, city)");
        setCompanies(adminRows ?? []);
      } catch { /* table may not exist */ }
      setLoading(false);
    })();
  }, []);

  const filtered = companies.filter((c: any) =>
    !search || c.company?.name?.toLowerCase().includes(search.toLowerCase())
  );

  const statusColor = (s: string) =>
    s === "active" ? "default" : s === "trial" ? "secondary" : s === "blocked" ? "destructive" : "outline";
  const statusLabel = (s: string) =>
    s === "active" ? "Ativo" : s === "blocked" ? "Bloqueado" : s === "trial" ? "Teste" : "Cancelado";
  const paymentLabel = (s: string) =>
    s === "paid" ? "Pago" : s === "pending" ? "Pendente" : s === "overdue" ? "Atrasado" : "Cancelado";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Empresas</h1>
        <p className="text-muted-foreground text-sm mt-1">Gerencie empresas cadastradas na plataforma.</p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar empresa..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <Building2 className="mx-auto h-8 w-8 mb-2 opacity-40" />
            <p>Nenhuma empresa encontrada.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c: any) => (
            <Link key={c.id} to="/admin/empresas/$id" params={{ id: c.company_id }} className="block">
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-display font-semibold">{c.company?.name ?? "—"}</h3>
                      <p className="text-xs text-muted-foreground">{c.company?.city ?? "—"}</p>
                    </div>
                    <Badge variant={statusColor(c.status) as any}>{statusLabel(c.status)}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>R$ {Number(c.monthly_fee).toFixed(2)}</span>
                    <span>{paymentLabel(c.payment_status)}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
