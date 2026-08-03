// Sessão do cliente B2C. Guarda APENAS identificadores (não dados de domínio).
// Dados vivem no Cloud; localStorage aqui é apenas a "chave" para reencontrar o customer.
const KEY = "weaze.session.v1";
const PROFILE_KEY = "weaze.profile.v1";
const ANON_KEY = "weaze.anon.v1";

export const ANONYMOUS_NAME = "Visitante";

/** Identificador anônimo estável por aparelho, usado como chave silenciosa
 *  (whatsapp placeholder) quando o cliente entra pelo QR sem cadastro. */
export function getAnonymousId(): string {
  if (typeof window === "undefined") {
    return `anon-${Math.random().toString(36).slice(2, 10)}`;
  }
  let id = window.localStorage.getItem(ANON_KEY);
  if (!id) {
    id = `anon-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(ANON_KEY, id);
  }
  return id;
}

export type WeazeProfile = { name: string; whatsapp: string };

export function getLastProfile(): WeazeProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY);
    return raw ? (JSON.parse(raw) as WeazeProfile) : null;
  } catch {
    return null;
  }
}

export function setLastProfile(p: WeazeProfile) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
}

export function clearLastProfile() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(PROFILE_KEY);
}
const SESSION_DURATION_MS = 7 * 60 * 60 * 1000; // 7 hours

export type WeazeSession = {
  customerId: string;
  companyId: string;
  companySlug: string;
  // Token opaco emitido pelo backend no upsert do cliente; usado para autorizar
  // mutações do próprio cliente (perfil, reações, curtidas, desejos) via RPCs.
  sessionToken: string;
  /** Timestamp (Date.now()) de quando a sessão foi criada. Sessões sem este campo
   *  são consideradas expiradas e o cliente deve fazer check-in novamente. */
  createdAt?: number;
};

export function getSession(): WeazeSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as WeazeSession) : null;
  } catch {
    return null;
  }
}

export function setSession(s: WeazeSession) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(s));
}

export function clearSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}

export function getSessionForCompany(companySlug: string): WeazeSession | null {
  const s = getSession();
  if (!s || s.companySlug !== companySlug || !s.sessionToken) return null;
  // Sessões sem createdAt ou com createdAt expirado são tratadas como inexistentes.
  // Também limpa o perfil em cache para forçar nova leitura do QR (não é rede social).
  if (!s.createdAt || Date.now() - s.createdAt > SESSION_DURATION_MS) {
    clearSession();
    clearLastProfile();
    return null;
  }
  return s;
}

/** Timestamp (ms) em que a sessão expira. Null se não houver sessão. */
export function getSessionExpiry(): number | null {
  const s = getSession();
  if (!s) return null;
  // Sessões sem createdAt são tratadas como já expiradas
  if (!s.createdAt) return 0;
  return s.createdAt + SESSION_DURATION_MS;
}

/** Retorna os milissegundos restantes até a expiração. Null se não houver sessão. */
export function getSessionRemainingMs(): number | null {
  const expiry = getSessionExpiry();
  if (expiry === null) return null;
  return Math.max(0, expiry - Date.now());
}
