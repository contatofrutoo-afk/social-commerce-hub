import { supabase } from "@/integrations/supabase/client";
import { LEGAL_VERSION } from "@/lib/legal";

export type LegalDocument = "terms" | "privacy";

/** Registra o aceite dos documentos legais para o usuário autenticado. */
export async function recordLegalConsents(
  userId: string,
  documents: LegalDocument[] = ["terms", "privacy"],
  version: string = LEGAL_VERSION,
) {
  const rows = documents.map((document) => ({ user_id: userId, document, version }));
  const { error } = await (supabase as any)
    .from("user_consents")
    .upsert(rows, { onConflict: "user_id,document,version", ignoreDuplicates: true });
  if (error) throw error;
}

/** Retorna quais documentos da versão atual ainda não foram aceitos pelo usuário. */
export async function pendingLegalConsents(userId: string, version: string = LEGAL_VERSION) {
  const { data, error } = await (supabase as any)
    .from("user_consents")
    .select("document")
    .eq("user_id", userId)
    .eq("version", version);
  if (error) return [] as LegalDocument[];
  const accepted = new Set((data ?? []).map((r: any) => r.document));
  return (["terms", "privacy"] as LegalDocument[]).filter((d) => !accepted.has(d));
}
