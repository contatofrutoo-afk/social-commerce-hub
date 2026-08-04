import { useState, useRef, useCallback } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatBRL } from "@/lib/format";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  GripVertical,
  Plus,
  Trash2,
  ImagePlus,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { ProductOptionType } from "@/repositories/types";

export interface ProductOptionValueDraft {
  id: string;
  label: string;
  priceAdjust: number;
  available: boolean;
  imageUrl?: string | null;
}

export interface ProductOptionDraft {
  id: string;
  name: string;
  optionType: ProductOptionType;
  required: boolean;
  minSelect: number | null;
  maxSelect: number | null;
  priceAdjust: number;
  values: ProductOptionValueDraft[];
}

let _seq = 0;
function newId() {
  _seq += 1;
  return `opt_${Date.now()}_${_seq}`;
}

const TYPE_LABELS: Record<ProductOptionType, string> = {
  single: "Escolha única",
  multiple: "Escolha múltipla",
  text: "Texto livre",
  quantity: "Quantidade",
  toggle: "Ligar / desligar",
};

export function newOption(): ProductOptionDraft {
  return {
    id: newId(),
    name: "",
    optionType: "single",
    required: false,
    minSelect: null,
    maxSelect: null,
    priceAdjust: 0,
    values: [],
  };
}

export function draftFromProductOption(o: {
  id: string;
  name: string;
  optionType: ProductOptionType;
  required: boolean;
  minSelect: number | null;
  maxSelect: number | null;
  priceAdjust: number;
  values: {
    id: string;
    label: string;
    priceAdjust: number;
    available: boolean;
    imageUrl?: string | null;
  }[];
}): ProductOptionDraft {
  return {
    id: o.id,
    name: o.name,
    optionType: o.optionType,
    required: o.required,
    minSelect: o.minSelect,
    maxSelect: o.maxSelect,
    priceAdjust: o.priceAdjust,
    values: (o.values ?? []).map((v) => ({
      id: v.id,
      label: v.label,
      priceAdjust: v.priceAdjust,
      available: v.available,
      imageUrl: v.imageUrl ?? null,
    })),
  };
}

export function ProductOptionsEditor({
  value,
  onChange,
}: {
  value: ProductOptionDraft[];
  onChange: (v: ProductOptionDraft[]) => void;
}) {
  const [open, setOpen] = useState(value.length > 0);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  const update = (id: string, patch: Partial<ProductOptionDraft>) =>
    onChange(value.map((o) => (o.id === id ? { ...o, ...patch } : o)));

  const addOption = () => {
    onChange([...value, newOption()]);
    setOpen(true);
  };

  const duplicate = (o: ProductOptionDraft) => {
    const copy: ProductOptionDraft = {
      ...o,
      id: newId(),
      name: o.name ? `${o.name} (cópia)` : "",
      values: o.values.map((v) => ({ ...v, id: newId() })),
    };
    onChange([...value, copy]);
    setOpen(true);
  };

  const remove = (id: string) => onChange(value.filter((o) => o.id !== id));

  const onDragStart = useCallback((e: React.DragEvent, idx: number) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(idx));
    setDragIdx(idx);
  }, []);

  const onDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setOverIdx(idx);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent, targetIdx: number) => {
      e.preventDefault();
      const sourceIdx = dragIdx;
      setDragIdx(null);
      setOverIdx(null);
      if (sourceIdx === null || sourceIdx === targetIdx) return;
      const next = [...value];
      const [moved] = next.splice(sourceIdx, 1);
      next.splice(targetIdx, 0, moved);
      onChange(next);
    },
    [dragIdx, value, onChange],
  );

  const onDragEnd = useCallback(() => {
    setDragIdx(null);
    setOverIdx(null);
  }, []);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-xl border bg-muted/30">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex flex-1 items-center gap-2 text-sm font-medium text-left"
          >
            <GripVertical className="size-4 text-muted-foreground" />
            Opções do Produto
            {value.length > 0 && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                {value.length}
              </span>
            )}
            <span className="text-xs font-normal text-muted-foreground">
              {value.length === 0
                ? "Nenhuma opção configurada"
                : "Escolha única, múltipla, texto, quantidade ou liga/desliga"}
            </span>
          </button>
        </CollapsibleTrigger>
        <Button type="button" size="sm" variant="outline" onClick={addOption} className="shrink-0">
          <Plus className="mr-1 size-3" /> Adicionar
        </Button>
        <CollapsibleTrigger asChild>
          <Button type="button" size="sm" variant="ghost" className="shrink-0 px-2">
            <ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} />
          </Button>
        </CollapsibleTrigger>
      </div>

      <CollapsibleContent>
        <div className="space-y-3 border-t px-3 py-3">
          {value.length === 0 && (
            <p className="py-2 text-center text-xs text-muted-foreground">
              Nenhuma opção. Clique em "Adicionar" para configurar personalizações do produto.
            </p>
          )}
          {value.map((o, index) => (
            <div
              key={o.id}
              draggable
              onDragStart={(e) => onDragStart(e, index)}
              onDragOver={(e) => onDragOver(e, index)}
              onDrop={(e) => onDrop(e, index)}
              onDragEnd={onDragEnd}
              className={`transition ${dragIdx === index ? "opacity-50" : ""} ${overIdx === index && dragIdx !== null && dragIdx !== index ? "border-t-2 border-primary" : ""}`}
            >
              <OptionCard
                option={o}
                onUpdate={(patch) => update(o.id, patch)}
                onDuplicate={() => duplicate(o)}
                onRemove={() => remove(o.id)}
              />
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function OptionCard({
  option,
  onUpdate,
  onDuplicate,
  onRemove,
}: {
  option: ProductOptionDraft;
  onUpdate: (patch: Partial<ProductOptionDraft>) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const hasValues = option.optionType === "single" || option.optionType === "multiple";

  const updateValue = (valueId: string, patch: Partial<ProductOptionValueDraft>) =>
    onUpdate({
      values: option.values.map((v) => (v.id === valueId ? { ...v, ...patch } : v)),
    });

  const addValue = () =>
    onUpdate({
      values: [
        ...option.values,
        { id: newId(), label: "", priceAdjust: 0, available: true, imageUrl: null },
      ],
    });

  const removeValue = (valueId: string) =>
    onUpdate({ values: option.values.filter((v) => v.id !== valueId) });

  const [valDragIdx, setValDragIdx] = useState<number | null>(null);
  const [valOverIdx, setValOverIdx] = useState<number | null>(null);

  const onValDragStart = useCallback((e: React.DragEvent, idx: number) => {
    e.stopPropagation();
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(idx));
    setValDragIdx(idx);
  }, []);

  const onValDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    setValOverIdx(idx);
  }, []);

  const onValDrop = useCallback(
    (e: React.DragEvent, targetIdx: number) => {
      e.preventDefault();
      e.stopPropagation();
      const sourceIdx = valDragIdx;
      setValDragIdx(null);
      setValOverIdx(null);
      if (sourceIdx === null || sourceIdx === targetIdx) return;
      const next = [...option.values];
      const [moved] = next.splice(sourceIdx, 1);
      next.splice(targetIdx, 0, moved);
      onUpdate({ values: next });
    },
    [valDragIdx, option.values, onUpdate],
  );

  const onValDragEnd = useCallback(() => {
    setValDragIdx(null);
    setValOverIdx(null);
  }, []);

  async function uploadValueImage(file: File, valueId: string) {
    const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!ALLOWED.includes(file.type)) return;
    if (file.size > 5 * 1024 * 1024) return;
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `option-values/${valueId}_${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("weaze-media").upload(path, file, {
      contentType: file.type,
      upsert: true,
    });
    if (error) return;
    const { data } = supabase.storage.from("weaze-media").getPublicUrl(path);
    if (data?.publicUrl) updateValue(valueId, { imageUrl: data.publicUrl });
  }

  return (
    <div className="rounded-xl border bg-card p-3 space-y-3">
      <div className="flex items-center gap-2">
        <GripVertical className="size-4 shrink-0 cursor-grab text-muted-foreground" />
        <Input
          value={option.name}
          placeholder="Nome da opção (ex.: Tamanho)"
          onChange={(e) => onUpdate({ name: e.target.value })}
          className="h-8 flex-1"
        />
        <Select
          value={option.optionType}
          onValueChange={(v) => onUpdate({ optionType: v as ProductOptionType })}
        >
          <SelectTrigger className="h-8 w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(TYPE_LABELS) as ProductOptionType[]).map((t) => (
              <SelectItem key={t} value={t}>
                {TYPE_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={onDuplicate}
            title="Duplicar"
            className="rounded p-1.5 text-muted-foreground hover:text-foreground"
          >
            <Copy className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            title="Excluir"
            className="rounded p-1.5 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      {(option.optionType === "single" || option.optionType === "multiple") && (
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">Obrigatória</Label>
          <Switch checked={option.required} onCheckedChange={(v) => onUpdate({ required: v })} />
        </div>
      )}

      {option.optionType === "text" && (
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">Obrigatório preencher</Label>
          <Switch checked={option.required} onCheckedChange={(v) => onUpdate({ required: v })} />
        </div>
      )}

      {option.optionType === "quantity" && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs text-muted-foreground">Preço por unidade</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={option.priceAdjust}
              onChange={(e) => onUpdate({ priceAdjust: Number(e.target.value) })}
              className="h-8"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Quantidade máxima</Label>
            <Input
              type="number"
              min="1"
              placeholder="Ilimitado"
              value={option.maxSelect ?? ""}
              onChange={(e) =>
                onUpdate({ maxSelect: e.target.value ? Number(e.target.value) : null })
              }
              className="h-8"
            />
          </div>
        </div>
      )}

      {option.optionType === "toggle" && (
        <div>
          <Label className="text-xs text-muted-foreground">Preço quando ativado</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={option.priceAdjust}
            onChange={(e) => onUpdate({ priceAdjust: Number(e.target.value) })}
            className="h-8"
          />
        </div>
      )}

      {hasValues && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium">Valores</Label>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={addValue}
              className="h-7 text-xs"
            >
              <Plus className="mr-1 size-3" /> Adicionar valor
            </Button>
          </div>
          {option.values.length === 0 && (
            <p className="py-1 text-center text-xs text-muted-foreground">Nenhum valor ainda.</p>
          )}
          {option.values.map((v, index) => (
            <div
              key={v.id}
              draggable
              onDragStart={(e) => onValDragStart(e, index)}
              onDragOver={(e) => onValDragOver(e, index)}
              onDrop={(e) => onValDrop(e, index)}
              onDragEnd={onValDragEnd}
              className={`flex items-center gap-2 rounded-lg border bg-muted/40 px-2 py-1.5 transition ${
                valDragIdx === index ? "opacity-50" : ""
              } ${valOverIdx === index && valDragIdx !== null && valDragIdx !== index ? "border-t-2 border-primary" : ""}`}
            >
              <GripVertical className="size-3 shrink-0 cursor-grab text-muted-foreground" />
              <ValueImageUpload
                imageUrl={v.imageUrl ?? null}
                onUpload={(file) => uploadValueImage(file, v.id)}
                onRemove={() => updateValue(v.id, { imageUrl: null })}
              />
              <Input
                value={v.label}
                placeholder="Valor (ex.: Grande)"
                onChange={(e) => updateValue(v.id, { label: e.target.value })}
                className="h-7 flex-1 text-xs"
              />
              <div className="relative">
                <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  R$
                </span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={v.priceAdjust}
                  onChange={(e) => updateValue(v.id, { priceAdjust: Number(e.target.value) })}
                  className="h-7 w-20 pl-7 text-xs"
                  title="Preço adicional"
                />
              </div>
              <Switch
                checked={v.available}
                onCheckedChange={(avail) => updateValue(v.id, { available: avail })}
                title={v.available ? "Disponível" : "Indisponível"}
              />
              <button
                type="button"
                onClick={() => removeValue(v.id)}
                className="rounded p-1 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-3" />
              </button>
            </div>
          ))}
          {option.values.some((v) => v.priceAdjust > 0) && (
            <p className="text-[10px] text-muted-foreground">
              Ex.: {formatBRL(option.values[0]?.priceAdjust ?? 0)} de adicional por valor
              selecionado.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function ValueImageUpload({
  imageUrl,
  onUpload,
  onRemove,
}: {
  imageUrl: string | null;
  onUpload: (file: File) => void;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="relative shrink-0">
      {imageUrl ? (
        <>
          <img src={imageUrl} alt="" className="size-7 rounded-md object-cover" />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="absolute -right-1 -top-1 grid size-3.5 place-items-center rounded-full bg-destructive text-destructive-foreground"
          >
            <X className="size-2" />
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            inputRef.current?.click();
          }}
          className="grid size-7 place-items-center rounded-md border border-dashed text-muted-foreground hover:bg-muted/60"
          title="Adicionar imagem"
        >
          <ImagePlus className="size-3" />
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onUpload(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
