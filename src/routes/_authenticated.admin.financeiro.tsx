import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, Check, X, Loader2, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/financeiro")({
  component: WeazeFinanceiro,
  head: () => ({ meta: [{ title: "Financeiro — WEAZE Admin" }] }),
});

const paymentStatusLabel: Record<string, string> = {
  paid: "Pago",
  pending: "Em Aberto",
  overdue: "Atrasado",
  cancelled: "Cancelado",
};

const paymentStatusColor: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  paid: "default",
  pending: "secondary",
  overdue: "destructive",
  cancelled: "outline",
};

const PLAN_OPTIONS = ["Mensal", "Anual", "Promocional", "Personalizado"];
const METHOD_OPTIONS = ["PIX", "Cartão", "Dinheiro", "Outro"];
const STATUS_OPTIONS = [
  { value: "paid", label: "Pago" },
  { value: "pending", label: "Em Aberto" },
  { value: "overdue", label: "Atrasado" },
  { value: "cancelled", label: "Cancelado" },
];

const STATUS_MAP_TO_EN: Record<string, string> = {
  ativo: "active",
  bloqueado: "blocked",
  teste: "trial",
  cancelado: "cancelled",
};

async function updateCompanyField(companyId: string, field: string, value: any) {
  const { error } = await supabase
    .from("companies")
    .update({ [field]: value } as any)
    .eq("id", companyId);
  if (error) {
    if (
      error.code === "42703" ||
      error.message?.includes("column") ||
      error.message?.includes("does not exist")
    ) {
      const { error: fbErr } = await supabase
        .from("company_admin")
        .upsert({ company_id: companyId, [field]: value } as any, { onConflict: "company_id" });
      if (fbErr) throw fbErr;
    } else {
      throw error;
    }
  }
}

interface EditingCell {
  rowId: string;
  field: string;
  value: any;
}

function useClickOutside(ref: { current: HTMLElement | null }, handler: () => void) {
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) handler();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [ref, handler]);
}

function EditableTextCell({ row, field, label }: { row: any; field: string; label?: string }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(row[field] ?? "");
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const cancel = useCallback(() => {
    setEditing(false);
    setValue(row[field] ?? "");
  }, [row, field]);

  useClickOutside(ref, cancel);

  const save = async () => {
    if (value === (row[field] ?? "")) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await updateCompanyField(row.id, field, value || null);
      row[field] = value || null;
      toast.success(label ? `${label} atualizado!` : "Atualizado!");
      setEditing(false);
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao salvar");
      setValue(row[field] ?? "");
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") save();
    if (e.key === "Escape") cancel();
  };

  if (editing) {
    return (
      <div ref={ref} className="flex items-center gap-1">
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-8 w-28 text-xs"
        />
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
        ) : (
          <>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={save}>
              <Check className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={cancel}>
              <X className="h-3 w-3" />
            </Button>
          </>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      className="group flex items-center gap-1 hover:bg-muted/50 rounded px-1 -ml-1 transition-colors"
      onClick={() => {
        setValue(row[field] ?? "");
        setEditing(true);
      }}
    >
      <span>{row[field] ?? "—"}</span>
      <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-40 transition-opacity shrink-0" />
    </button>
  );
}

function EditableNumberCell({ row, field }: { row: any; field: string }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(Number(row[field] ?? 0).toFixed(2)));
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const cancel = useCallback(() => {
    setEditing(false);
    setValue(String(Number(row[field] ?? 0).toFixed(2)));
  }, [row, field]);

  useClickOutside(ref, cancel);

  const save = async () => {
    const num = parseFloat(value.replace(",", "."));
    if (isNaN(num) || num === Number(row[field])) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await updateCompanyField(row.id, field, num);
      row[field] = num;
      toast.success("Valor atualizado!");
      setEditing(false);
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao salvar");
      setValue(String(Number(row[field] ?? 0).toFixed(2)));
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") save();
    if (e.key === "Escape") cancel();
  };

  if (editing) {
    return (
      <div ref={ref} className="flex items-center gap-1">
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-8 w-24 text-xs font-medium"
        />
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
        ) : (
          <>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={save}>
              <Check className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={cancel}>
              <X className="h-3 w-3" />
            </Button>
          </>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      className="group flex items-center gap-1 font-medium hover:bg-muted/50 rounded px-1 -ml-1 transition-colors"
      onClick={() => {
        setValue(String(Number(row[field] ?? 0).toFixed(2)));
        setEditing(true);
      }}
    >
      <span>R$ {Number(row[field]).toFixed(2)}</span>
      <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-40 transition-opacity shrink-0" />
    </button>
  );
}

function EditableDateCell({ row, field }: { row: any; field: string }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(row[field] ?? "");
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.showPicker?.();
    }
  }, [editing]);

  const cancel = useCallback(() => {
    setEditing(false);
    setValue(row[field] ?? "");
  }, [row, field]);

  useClickOutside(ref, cancel);

  const save = async () => {
    if (value === (row[field] ?? "")) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      const dbValue = value || null;
      await updateCompanyField(row.id, field, dbValue);
      row[field] = dbValue;
      toast.success("Data atualizada!");
      setEditing(false);
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao salvar");
      setValue(row[field] ?? "");
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") save();
    if (e.key === "Escape") cancel();
  };

  if (editing) {
    return (
      <div ref={ref} className="flex items-center gap-1">
        <Input
          ref={inputRef}
          type="date"
          value={value ? value.split("T")[0] : ""}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-8 w-36 text-xs"
        />
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
        ) : (
          <>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={save}>
              <Check className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={cancel}>
              <X className="h-3 w-3" />
            </Button>
          </>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      className="group flex items-center gap-1 text-muted-foreground hover:bg-muted/50 rounded px-1 -ml-1 transition-colors"
      onClick={() => {
        setValue(row[field] ?? "");
        setEditing(true);
      }}
    >
      <span>{row[field] ? new Date(row[field]).toLocaleDateString("pt-BR") : "—"}</span>
      <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-40 transition-opacity shrink-0" />
    </button>
  );
}

function EditableSelectCell({
  row,
  field,
  options,
  label,
}: {
  row: any;
  field: string;
  options: { value: string; label: string }[];
  label?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(row[field] ?? "");
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useClickOutside(ref, () => {
    if (editing) setEditing(false);
  });

  const save = async (newValue: string) => {
    if (newValue === row[field]) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await updateCompanyField(row.id, field, newValue);
      row[field] = newValue;
      toast.success(label ? `${label} atualizado!` : "Atualizado!");
      setEditing(false);
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div ref={ref} className="flex items-center gap-1">
        <Select
          value={value}
          onValueChange={(v) => {
            setValue(v);
            save(v);
          }}
        >
          <SelectTrigger className="h-8 w-32 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {saving && <Loader2 className="h-4 w-4 animate-spin shrink-0" />}
      </div>
    );
  }

  return (
    <button
      type="button"
      className="group flex items-center gap-1 hover:bg-muted/50 rounded px-1 -ml-1 transition-colors"
      onClick={() => {
        setValue(row[field] ?? "");
        setEditing(true);
      }}
    >
      <span>{row[field]}</span>
      <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-40 transition-opacity shrink-0" />
    </button>
  );
}

function WeazeFinanceiro() {
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [defaultFee, setDefaultFee] = useState(237);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [companiesRes, settingsRes] = await Promise.all([
          supabase
            .from("companies")
            .select(
              "id, name, slug, city, responsible, status, plan_type, monthly_fee, payment_status, payment_method, next_due_date, last_payment_date",
            )
            .order("name"),
          supabase.from("admin_settings").select("default_plan_value").limit(1).maybeSingle(),
        ]);
        setRows(companiesRes.data ?? []);
        if (settingsRes.data) {
          setDefaultFee(Number(settingsRes.data.default_plan_value ?? 237));
        }
      } catch (err) {
        console.error("Erro ao carregar empresas:", err);
        toast.error("Erro ao carregar dados financeiros.");
      }
      setLoading(false);
    })();
  }, []);

  const filtered = rows.filter(
    (r: any) => !search || r.name?.toLowerCase().includes(search.toLowerCase()),
  );

  const kpis = (() => {
    let receivable = 0,
      received = 0,
      overdue = 0;
    let pendingCount = 0,
      paidCount = 0,
      overdueCount = 0;
    (rows ?? []).forEach((r: any) => {
      const fee = Number(defaultFee) || 0;
      if (r.payment_status === "paid") {
        received += fee;
        paidCount++;
      } else if (r.payment_status === "pending") {
        receivable += fee;
        pendingCount++;
      } else if (r.payment_status === "overdue") {
        receivable += fee;
        overdueCount++;
        overdue += fee;
      }
    });
    return {
      receivable,
      received,
      overdue,
      pendingCount,
      paidCount,
      overdueCount,
      avgTicket: paidCount > 0 ? received / paidCount : 0,
    };
  })();

  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);

  return (
    <div className={cn("space-y-6", loading && "opacity-50 pointer-events-none")}>
      <div>
        <h1 className="font-display text-3xl">Financeiro</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Controle financeiro dos estabelecimentos.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">A Receber</p>
            <p className="font-display text-2xl mt-1">
              R$ {kpis.receivable.toLocaleString("pt-BR")}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{kpis.pendingCount} pendentes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Recebido</p>
            <p className="font-display text-2xl mt-1">R$ {kpis.received.toLocaleString("pt-BR")}</p>
            <p className="text-xs text-muted-foreground mt-1">{kpis.paidCount} pagos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Em Atraso</p>
            <p className="font-display text-2xl mt-1 text-destructive">
              R$ {kpis.overdue.toLocaleString("pt-BR")}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{kpis.overdueCount} empresas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Ticket Médio</p>
            <p className="font-display text-2xl mt-1">
              R$ {kpis.avgTicket.toLocaleString("pt-BR")}
            </p>
            <p className="text-xs text-muted-foreground mt-1">por empresa</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="font-display text-base">Todas as Empresas</CardTitle>
            <div className="relative max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar empresa..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground text-center">
              Nenhum registro encontrado.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                    <th className="px-5 py-3 font-medium">Empresa</th>
                    <th className="px-5 py-3 font-medium">Responsável</th>
                    <th className="px-5 py-3 font-medium">Plano</th>
                    <th className="px-5 py-3 font-medium">Valor</th>
                    <th className="px-5 py-3 font-medium">Último Pagamento</th>
                    <th className="px-5 py-3 font-medium">Vencimento</th>
                    <th className="px-5 py-3 font-medium">Forma</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r: any) => (
                    <tr
                      key={r.id}
                      className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-5 py-3">
                        <Link
                          to="/admin/empresas/$id"
                          params={{ id: r.id }}
                          className="font-medium hover:underline"
                        >
                          {r.name ?? "—"}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">
                        <EditableTextCell row={r} field="responsible" label="Responsável" />
                      </td>
                      <td className="px-5 py-3">
                        <EditableSelectCell
                          row={r}
                          field="plan_type"
                          options={PLAN_OPTIONS.map((p) => ({ value: p, label: p }))}
                          label="Plano"
                        />
                      </td>
                      <td className="px-5 py-3">
                        <span className="font-medium">R$ {Number(defaultFee).toFixed(2)}</span>
                      </td>
                      <td className="px-5 py-3">
                        <EditableDateCell row={r} field="last_payment_date" />
                      </td>
                      <td className="px-5 py-3">
                        <EditableDateCell row={r} field="next_due_date" />
                      </td>
                      <td className="px-5 py-3">
                        <EditableSelectCell
                          row={r}
                          field="payment_method"
                          options={METHOD_OPTIONS.map((p) => ({ value: p, label: p }))}
                          label="Forma"
                        />
                      </td>
                      <td className="px-5 py-3">
                        <EditableSelectCell
                          row={r}
                          field="payment_status"
                          options={STATUS_OPTIONS}
                          label="Status"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
