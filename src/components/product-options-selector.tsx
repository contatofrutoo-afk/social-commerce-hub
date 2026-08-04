import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { formatBRL } from "@/lib/format";
import { Minus, Plus } from "lucide-react";
import type { ProductOption, SelectedOption } from "@/repositories/types";

/** Estado de seleção de uma opção (uma entrada por opção). */
export interface OptionSelection {
  valueIds: string[];
  text: string;
  qty: number;
}
export type SelectionMap = Record<string, OptionSelection>;

function emptySelection(): OptionSelection {
  return { valueIds: [], text: "", qty: 0 };
}

export function getSelection(sel: SelectionMap, optionId: string): OptionSelection {
  return sel[optionId] ?? emptySelection();
}

/** Seleção inicial: opções single obrigatórias já vêm com o 1º valor marcado. */
export function defaultSelections(options: ProductOption[]): SelectionMap {
  const map: SelectionMap = {};
  for (const o of options) {
    if (o.optionType === "single" && o.required) {
      const first = o.values.find((v) => v.available);
      if (first) map[o.id] = { valueIds: [first.id], text: "", qty: 0 };
    }
  }
  return map;
}

/** Converte a SelectionMap nas opções que entram no carrinho/pedido. */
export function optionsFromSelections(
  options: ProductOption[],
  sel: SelectionMap,
): SelectedOption[] {
  const out: SelectedOption[] = [];
  for (const o of options) {
    const s = getSelection(sel, o.id);
    if (o.optionType === "single" || o.optionType === "multiple") {
      for (const valueId of s.valueIds) {
        const v = o.values.find((x) => x.id === valueId);
        if (v) {
          out.push({
            optionId: o.id,
            optionName: o.name,
            valueId: v.id,
            valueLabel: v.label,
            priceAdjust: v.priceAdjust,
            quantity: 1,
          });
        }
      }
    } else if (o.optionType === "text") {
      const text = s.text.trim();
      if (text) {
        out.push({
          optionId: o.id,
          optionName: o.name,
          freeText: text,
          priceAdjust: 0,
          quantity: 1,
        });
      }
    } else if (o.optionType === "quantity") {
      if (s.qty > 0) {
        out.push({
          optionId: o.id,
          optionName: o.name,
          priceAdjust: o.priceAdjust,
          quantity: s.qty,
        });
      }
    } else if (o.optionType === "toggle") {
      if (s.qty > 0) {
        out.push({ optionId: o.id, optionName: o.name, priceAdjust: o.priceAdjust, quantity: 1 });
      }
    }
  }
  return out;
}

/** Soma dos ajustes das opções selecionadas (para o preço unitário). */
export function selectionsAdjust(options: ProductOption[], sel: SelectionMap): number {
  return optionsFromSelections(options, sel).reduce(
    (s, o) => s + o.priceAdjust * (o.quantity ?? 1),
    0,
  );
}

/** true se alguma opção obrigatória não foi preenchida. */
export function hasRequiredMissing(options: ProductOption[], sel: SelectionMap): boolean {
  for (const o of options) {
    const s = getSelection(sel, o.id);
    if (o.optionType === "single" || o.optionType === "multiple") {
      const count = s.valueIds.length;
      if (o.required && count === 0) return true;
      if (o.minSelect != null && count < o.minSelect) return true;
      if (o.maxSelect != null && count > o.maxSelect) return true;
    } else if (o.optionType === "text") {
      if (o.required && !s.text.trim()) return true;
    }
  }
  return false;
}

function priceLabel(value: number): string {
  return value > 0 ? `+ ${formatBRL(value)}` : "Grátis";
}

export function ProductOptionsSelector({
  options,
  selections,
  onChange,
}: {
  options: ProductOption[];
  selections: SelectionMap;
  onChange: (s: SelectionMap) => void;
}) {
  const set = (optionId: string, patch: Partial<OptionSelection>) =>
    onChange({
      ...selections,
      [optionId]: { ...emptySelection(), ...getSelection(selections, optionId), ...patch },
    });

  return (
    <div className="space-y-4">
      {options.map((o) => {
        const s = getSelection(selections, o.id);

        return (
          <div key={o.id} className="rounded-xl border bg-card p-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-sm font-semibold">{o.name}</span>
              {o.required ? (
                <span className="rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
                  obrigatória
                </span>
              ) : (
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  opcional
                </span>
              )}
              {o.optionType === "quantity" && o.priceAdjust > 0 && (
                <span className="ml-auto text-xs text-muted-foreground">
                  {formatBRL(o.priceAdjust)}/un
                </span>
              )}
            </div>

            {(o.optionType === "single" || o.optionType === "multiple") && (
              <div className="space-y-1.5">
                {o.values.map((v) => {
                  const checked = s.valueIds.includes(v.id);
                  if (o.optionType === "single") {
                    return (
                      <button
                        key={v.id}
                        type="button"
                        disabled={!v.available}
                        onClick={() => set(o.id, { valueIds: [v.id] })}
                        className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                          checked
                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                            : "hover:bg-muted/40"
                        } ${!v.available ? "opacity-50" : ""}`}
                      >
                        {v.imageUrl && (
                          <img
                            src={v.imageUrl}
                            alt=""
                            className="size-8 shrink-0 rounded-md object-cover"
                          />
                        )}
                        <span className="flex-1 text-sm">{v.label}</span>
                        <span className="text-xs font-medium text-primary">
                          {priceLabel(v.priceAdjust)}
                        </span>
                      </button>
                    );
                  }
                  return (
                    <label
                      key={v.id}
                      className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 transition ${
                        checked ? "border-primary bg-primary/5" : "hover:bg-muted/40"
                      } ${!v.available ? "opacity-50" : ""}`}
                    >
                      <Checkbox
                        checked={checked}
                        disabled={!v.available}
                        onCheckedChange={(c) => {
                          const valueIds = c
                            ? [...s.valueIds, v.id]
                            : s.valueIds.filter((x) => x !== v.id);
                          set(o.id, { valueIds });
                        }}
                      />
                      {v.imageUrl && (
                        <img
                          src={v.imageUrl}
                          alt=""
                          className="size-8 shrink-0 rounded-md object-cover"
                        />
                      )}
                      <span className="flex-1 text-sm">{v.label}</span>
                      <span className="text-xs font-medium text-primary">
                        {priceLabel(v.priceAdjust)}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}

            {o.optionType === "text" && (
              <Input
                value={s.text}
                placeholder="Escreva aqui…"
                maxLength={120}
                onChange={(e) => set(o.id, { text: e.target.value })}
              />
            )}

            {o.optionType === "quantity" && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {s.qty > 0 && o.priceAdjust > 0
                    ? `${s.qty}× ${formatBRL(o.priceAdjust)} = ${formatBRL(o.priceAdjust * s.qty)}`
                    : "Selecione a quantidade"}
                </span>
                <QuantityStepper
                  qty={s.qty}
                  max={o.maxSelect ?? 20}
                  onChange={(qty) => set(o.id, { qty })}
                />
              </div>
            )}

            {o.optionType === "toggle" && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {s.qty > 0 ? priceLabel(o.priceAdjust) : "Desligado"}
                </span>
                <Switch
                  checked={s.qty > 0}
                  onCheckedChange={(on) => set(o.id, { qty: on ? 1 : 0 })}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function QuantityStepper({
  qty,
  max,
  onChange,
}: {
  qty: number;
  max: number;
  onChange: (qty: number) => void;
}) {
  return (
    <div className="flex items-center gap-1 rounded-full border">
      <button
        type="button"
        className="px-2.5 py-1.5 hover:bg-accent disabled:opacity-40"
        disabled={qty <= 0}
        onClick={() => onChange(Math.max(0, qty - 1))}
      >
        <Minus className="size-3.5" />
      </button>
      <span className="w-6 text-center text-sm font-medium tabular-nums">{qty}</span>
      <button
        type="button"
        className="px-2.5 py-1.5 hover:bg-accent disabled:opacity-40"
        disabled={qty >= max}
        onClick={() => onChange(Math.min(max, qty + 1))}
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}

/** Resumo compacto das opções congeladas em um item de pedido. */
export function OrderItemOptions({
  options,
  className,
}: {
  options?: Array<{
    optionName: string;
    valueLabel?: string | null;
    quantity?: number;
    priceAdjust?: number;
    freeText?: string | null;
  }>;
  className?: string;
}) {
  if (!options || options.length === 0) return null;
  return (
    <div className={`flex flex-wrap gap-1 ${className ?? ""}`}>
      {options.map((o, idx) => {
        const label = o.freeText
          ? `${o.optionName}: "${o.freeText}"`
          : o.valueLabel
            ? `${o.optionName}: ${o.valueLabel}`
            : o.optionName;
        const plus =
          (o.priceAdjust ?? 0) * (o.quantity ?? 1) > 0
            ? ` +${formatBRL((o.priceAdjust ?? 0) * (o.quantity ?? 1))}`
            : "";
        return (
          <span
            key={idx}
            className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
          >
            {label}
            {o.quantity && o.quantity > 1 ? ` ×${o.quantity}` : ""}
            {plus}
          </span>
        );
      })}
    </div>
  );
}
