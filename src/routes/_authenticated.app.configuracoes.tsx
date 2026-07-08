import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { companyRepository, tableRepository, dashboardRepository } from "@/repositories";
import type { BusinessMetrics } from "@/repositories/types";
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
import { formatBRL } from "@/lib/format";
import { toast } from "sonner";
import {
  Copy, QrCode, Trash2, Pencil, Check, X,
  Users, ShoppingCart, Store, TrendingUp, Heart, MessageCircle,
  Clock, Calendar, Sparkles, RefreshCw,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/configuracoes")({
  component: SettingsPage,
  head: () => ({ meta: [{ title: "Configurações — WEAZE" }] }),
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
  const { data: businessMetrics } = useQuery({
    queryKey: ["business-metrics", companyId],
    queryFn: () => dashboardRepository.getBusinessMetrics(companyId!),
    enabled: !!companyId,
  });

  const [name, setName] = useState("");
  const [welcome, setWelcome] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [tableLabel, setTableLabel] = useState("");
  const [tableSlug, setTableSlug] = useState("");
  const [editingTableId, setEditingTableId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editSlug, setEditSlug] = useState("");

  useEffect(() => {
    if (company) {
      setName(company.name);
      setWelcome(company.welcomeMessage);
      setLogoUrl(company.logoUrl);
    }
  }, [company]);

  const baseUrl = getBaseUrl();
  const generalLink = company ? `${baseUrl}/c/${company.slug}` : "";

  const save = useMutation({
    mutationFn: () =>
      companyRepository.update(companyId!, { name, welcomeMessage: welcome, logoUrl }),
    onSuccess: () => {
      toast.success("Salvo");
      qc.invalidateQueries({ queryKey: ["company-full"] });
      qc.invalidateQueries({ queryKey: ["my-role"] });
    },
  });

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !companyId) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "png";
      const filePath = `companies/${companyId}/logo.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("weaze-media")
        .upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage
        .from("weaze-media")
        .getPublicUrl(filePath);
      setLogoUrl(urlData.publicUrl);
      toast.success("Foto atualizada! Salve as alterações.");
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao enviar foto");
    } finally {
      setUploading(false);
    }
  }

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
        <div className="flex items-center gap-4">
          <div className="relative">
            {logoUrl ? (
              <img src={logoUrl} alt="" className="size-16 rounded-full object-cover" />
            ) : (
              <div className="grid size-16 place-items-center rounded-full bg-primary text-primary-foreground text-lg font-bold">
                {name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div>
            <Label htmlFor="logo-upload" className="cursor-pointer">
              <div className="rounded-lg border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted">
                {uploading ? "Enviando…" : "Alterar foto"}
              </div>
            </Label>
            <input
              id="logo-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleLogoUpload}
              disabled={uploading}
            />
            <p className="mt-1 text-[11px] text-muted-foreground">PNG, JPG ou WEBP · Máx 5MB</p>
          </div>
        </div>
        <div>
          <Label>Nome</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label>Mensagem de boas-vindas</Label>
          <Textarea value={welcome} onChange={(e) => setWelcome(e.target.value)} maxLength={200} />
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

      {/* Métricas do negócio */}
      {businessMetrics && (
        <div className="space-y-3 rounded-xl border bg-card p-4">
          <h2 className="font-semibold">Métricas do negócio</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MetricTile icon={Users} label="Clientes" value={businessMetrics.totalCustomers} />
            <MetricTile icon={Sparkles} label="Ativos (7d)" value={businessMetrics.activeCustomers} />
            <MetricTile icon={RefreshCw} label="Recorrentes" value={businessMetrics.recurringCustomers} />
            <MetricTile icon={Heart} label="Novos (30d)" value={businessMetrics.newCustomersLast30d} />
            <MetricTile icon={Store} label="Check-ins" value={businessMetrics.totalCheckins} />
            <MetricTile icon={ShoppingCart} label="Pedidos" value={businessMetrics.totalOrders} />
            <MetricTile icon={TrendingUp} label="Ticket médio" value={formatBRL(businessMetrics.avgTicket)} />
            <MetricTile icon={MessageCircle} label="Comentários" value={businessMetrics.totalComments} />
          </div>

          {businessMetrics.topProducts.length > 0 && (
            <div>
              <h3 className="mb-1 text-sm font-medium">Produtos mais pedidos</h3>
              <div className="space-y-1 text-xs">
                {businessMetrics.topProducts.slice(0, 5).map((p) => (
                  <div key={p.id} className="flex justify-between">
                    <span>{p.name}</span>
                    <span className="font-semibold">{p.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <h3 className="mb-1 flex items-center gap-1 text-sm font-medium">
                <Clock className="size-3" /> Horários de pico
              </h3>
              {businessMetrics.peakHours.slice(0, 4).map((h) => (
                <div key={h.hour} className="flex justify-between">
                  <span>{h.hour}h</span>
                  <span>{h.count} check-ins</span>
                </div>
              ))}
            </div>
            <div>
              <h3 className="mb-1 flex items-center gap-1 text-sm font-medium">
                <Calendar className="size-3" /> Dias de pico
              </h3>
              {businessMetrics.peakDays.slice(0, 4).map((d) => (
                <div key={d.day} className="flex justify-between">
                  <span className="capitalize">{d.day}</span>
                  <span>{d.count} check-ins</span>
                </div>
              ))}
            </div>
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

function MetricTile({ icon: Icon, label, value }: { icon: any; label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-muted p-2 text-center">
      <Icon className="mx-auto size-4 text-primary" />
      <div className="mt-1 text-lg font-bold">{value}</div>
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
    </div>
  );
}
