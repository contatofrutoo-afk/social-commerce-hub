import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { companyRepository, tableRepository } from "@/repositories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Copy, QrCode, Trash2, Pencil, Check, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/configuracoes")({
  component: SettingsPage,
});

function getBaseUrl() {
  if (typeof window === "undefined") return "";
  return window.location.origin;
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success("Link copiado!"),
    () => toast.error("Erro ao copiar"),
  );
}

function QrCodeDialog({ url, label }: { url: string; label: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="icon" variant="outline">
          <QrCode className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
        </DialogHeader>
        <div className="flex justify-center p-4">
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(url)}`}
            alt={`QR Code: ${url}`}
            className="rounded-lg"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

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
  const [editingTableId, setEditingTableId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editSlug, setEditSlug] = useState("");

  useEffect(() => {
    if (company) {
      setName(company.name);
      setWelcome(company.welcomeMessage);
      setColor(company.primaryColor);
    }
  }, [company]);

  const baseUrl = getBaseUrl();
  const generalLink = company ? `${baseUrl}/c/${company.slug}` : "";

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
      toast.success("Mesa adicionada!");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao adicionar mesa"),
  });

  const removeTable = useMutation({
    mutationFn: (id: string) => tableRepository.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tables"] });
      toast.success("Mesa removida");
    },
  });

  const updateTable = useMutation({
    mutationFn: ({ id, label, slug }: { id: string; label: string; slug: string }) =>
      tableRepository.update(id, { label, slug }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tables"] });
      setEditingTableId(null);
      toast.success("Mesa atualizada");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao atualizar mesa"),
  });

  const startEditing = (t: { id: string; label: string; slug: string }) => {
    setEditingTableId(t.id);
    setEditLabel(t.label);
    setEditSlug(t.slug);
  };

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Configurações</h1>

      {/* Dados do estabelecimento */}
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
      </div>

      {/* Link Geral */}
      {company && (
        <div className="space-y-3 rounded-xl border bg-card p-4">
          <h2 className="font-semibold">Link Geral</h2>
          <p className="text-sm text-muted-foreground">
            Link oficial do estabelecimento. Compartilhe com seus clientes.
          </p>
          <div className="flex items-center gap-2 rounded-lg bg-muted p-3">
            <code className="flex-1 text-sm break-all">{generalLink}</code>
          </div>
          <div className="flex gap-2">
            <Button
              variant="default"
              onClick={() => copyToClipboard(generalLink)}
            >
              <Copy className="size-4 mr-2" />
              Copiar Link
            </Button>
            <QrCodeDialog url={generalLink} label="QR Code — Link Geral" />
          </div>
        </div>
      )}

      {/* Mesas */}
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
          <Button
            onClick={() => addTable.mutate()}
            disabled={!tableLabel || !tableSlug || addTable.isPending}
          >
            Adicionar
          </Button>
        </div>
        <div className="space-y-2">
          {tables?.length === 0 && (
            <p className="text-sm text-muted-foreground py-2">
              Nenhuma mesa cadastrada. Adicione a primeira acima.
            </p>
          )}
          {tables?.map((t) => {
            const tableUrl = `${baseUrl}/c/${company?.slug}/m/${t.slug}`;
            const isEditing = editingTableId === t.id;

            return (
              <div key={t.id} className="rounded-lg border p-3">
                {isEditing ? (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Input
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        placeholder="Nome da mesa"
                        className="flex-1"
                      />
                      <Input
                        value={editSlug}
                        onChange={(e) => setEditSlug(e.target.value)}
                        placeholder="Slug"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() =>
                          updateTable.mutate({ id: t.id, label: editLabel, slug: editSlug })
                        }
                        disabled={!editLabel || !editSlug}
                      >
                        <Check className="size-4 mr-1" />
                        Salvar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingTableId(null)}
                      >
                        <X className="size-4 mr-1" />
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <div className="text-sm font-medium">{t.label}</div>
                        <code className="text-xs text-muted-foreground break-all">
                          {tableUrl}
                        </code>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => startEditing(t)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => removeTable.mutate(t.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => copyToClipboard(tableUrl)}
                      >
                        <Copy className="size-3 mr-1" />
                        Copiar Link
                      </Button>
                      <QrCodeDialog url={tableUrl} label={`QR Code — ${t.label}`} />
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
