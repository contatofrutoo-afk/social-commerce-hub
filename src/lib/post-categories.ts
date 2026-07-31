// Categorias opcionais das publicações do estabelecimento (área administrativa).
// Quando definidas, exibem um selo no card do Feed Catálogo.
export type PostCategoryKey = "promocao_do_dia" | "novidade" | "lancamento";

export interface PostCategory {
  key: PostCategoryKey;
  label: string;
}

export const POST_CATEGORIES: PostCategory[] = [
  { key: "promocao_do_dia", label: "Promoção do Dia" },
  { key: "novidade", label: "Novidade" },
  { key: "lancamento", label: "Lançamento" },
];

const BADGE_CLASSES: Record<PostCategoryKey, string> = {
  promocao_do_dia: "bg-orange-500/15 text-orange-600 ring-1 ring-orange-500/30",
  novidade: "bg-sky-500/15 text-sky-600 ring-1 ring-sky-500/30",
  lancamento: "bg-emerald-500/15 text-emerald-600 ring-1 ring-emerald-500/30",
};

const normalize = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s_-]+/g, "");

export function getPostCategoryBadge(category: string | null | undefined) {
  if (!category) return null;
  const n = normalize(category);
  const key =
    n === "promocaododia"
      ? "promocao_do_dia"
      : n === "novidade"
        ? "novidade"
        : n === "lancamento"
          ? "lancamento"
          : null;
  if (!key) return null;
  const label = POST_CATEGORIES.find((p) => p.key === key)?.label.toUpperCase() ?? "";
  return { label, className: BADGE_CLASSES[key] };
}
