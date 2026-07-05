import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { companyRepository, tableRepository } from "@/repositories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/configuracoes")({
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const { data: role } = useQuery({
    queryKey: ["my-role"],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("*, company:companies(*)")
        .limit(1)
        .maybeSingle();
      return data;
    },
  });
  const companyId = role?.company_id as string | undefined;

  const { data: company } = useQuery({
    queryKey: ["company-full", companyId],
    queryFn: () => companyRepository.findById(companyId!),
    enabled: !!companyId,
  });
  const { data: tables } = useQuery({
    queryKey: ["tables", companyId],
    queryFn: () => tableRepository.listByCompany(companyId!),
    enabled: !!companyId,
  });

  const [name, setName] = useState("");
  const [welcome, setWelcome] = useState("");
  const [color, setColor] = useState("#8800AA");
  const [tableLabel, setTableLabel] = useState("");
  const [tableSlug, setTableSlug] = useState("");

  useEffect(() => {
    if (company) {
      setName(company.name);
      setWelcome(company.welcomeMessage);
      setColor(company.primaryColor);
    }
  }, [company]);

  const save = useMutation({
    mutationFn: () =>
      companyRepository.update(companyId!, { name, welcomeMessage: welcome, primaryColor: color }),
    onSuccess: () => {
      toast.success("Salvo");
      qc.invalidateQueries({ queryKey: ["company-full"] });
      qc.invalidateQueries({ queryKey: ["my-role"] });
    },
  });

  const addTable = useMutation({
    mutationFn: () => tableRepository.create(companyId!, tableLabel, tableSlug),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tables"] });
      setTableLabel("");
      setTableSlug("");
    },
  });
  const removeTable = useMutation({
    mutationFn: (id: string) => tableRepository.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tables"] }),
  });

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Configurações</h1>

      <div className="space-y-3 rounded-xl border bg-card p-4">
        <h2 className="font-semibold">Estabelecimento</h2>
        <div>
          <Label>Nome</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label>Mensagem de boas-vindas</Label>
          <Textarea value={welcome} onChange={(e) => setWelcome(e.target.value)} maxLength={200} />
        </div>
        <div>
          <Label>Cor primária</Label>
          <div className="flex gap-2">
            <Input value={color} onChange={(e) => setColor(e.target.value)} />
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-10 w-14 rounded border"
            />
          </div>
        </div>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          Salvar
        </Button>
        {company && (
          <p className="text-xs text-muted-foreground">
            Link do cliente:{" "}
            <code className="rounded bg-muted px-1">/c/{company.slug}</code>
          </p>
        )}
      </div>

      <div className="space-y-3 rounded-xl border bg-card p-4">
        <h2 className="font-semibold">Mesas</h2>
        <div className="flex gap-2">
          <Input
            placeholder="Rótulo (ex: Mesa 5)"
            value={tableLabel}
            onChange={(e) => setTableLabel(e.target.value)}
          />
          <Input
            placeholder="Slug (ex: 5)"
            value={tableSlug}
            onChange={(e) => setTableSlug(e.target.value)}
          />
          <Button onClick={() => addTable.mutate()} disabled={!tableLabel || !tableSlug}>
            Adicionar
          </Button>
        </div>
        <div className="space-y-1">
          {tables?.map((t) => (
            <div key={t.id} className="flex items-center justify-between rounded border p-2">
              <div>
                <div className="text-sm font-medium">{t.label}</div>
                <div className="text-xs text-muted-foreground">
                  /c/{company?.slug}/m/{t.slug}
                </div>
              </div>
              <Button size="icon" variant="ghost" onClick={() => removeTable.mutate(t.id)}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
