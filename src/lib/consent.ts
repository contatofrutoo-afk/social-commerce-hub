import { supabase } from "@/integrations/supabase/client";
import { LEGAL_VERSION } from "@/lib/legal";

// ─────────────────────────────────────────────────────────────
// Consentimento B2B (usuário autenticado do painel) — persistido no banco.
// Registra o aceite dos Termos/Privacidade na tabela user_consents.
// ─────────────────────────────────────────────────────────────
export type LegalDocument = "terms" | "privacy";

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

// ─────────────────────────────────────────────────────────────
// Consentimento B2C (cliente via QR Code Geral/Mesa) — local, LGPD.
// Guarda APENAS a aceitação no dispositivo; nenhum dado pessoal é coletado.
// A versão é amarrada a LEGAL_VERSION (lib/legal.ts): ao alterar os documentos
// jurídicos, incremente a versão lá para solicitar um novo aceite no dispositivo.
// ─────────────────────────────────────────────────────────────
const CLIENT_CONSENT_KEY = "weaze.consent.v1";

export type ConsentRecord = {
  version: string;
  acceptedAt: number;
};

/** O cliente já aceitou os documentos na versão vigente neste dispositivo? */
export function hasConsent(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(CLIENT_CONSENT_KEY);
    if (!raw) return false;
    const record = JSON.parse(raw) as ConsentRecord;
    return record.version === LEGAL_VERSION && typeof record.acceptedAt === "number";
  } catch {
    return false;
  }
}

/** Registra localmente a aceitação dos documentos na versão vigente. */
export function acceptConsent(): void {
  if (typeof window === "undefined") return;
  const record: ConsentRecord = { version: LEGAL_VERSION, acceptedAt: Date.now() };
  window.localStorage.setItem(CLIENT_CONSENT_KEY, JSON.stringify(record));
}
