// Onboarding silencioso da jornada do cliente via QR (QR Geral e QR da Mesa).
// Elimina a barreira de cadastro: cria a sessão em segundo plano, sem formulário.
import { customerRepository, checkinRepository } from "@/repositories";
import { getClientIp } from "@/lib/client-ip";
import {
  getSessionForCompany,
  setSession,
  getLastProfile,
  getAnonymousId,
  ANONYMOUS_NAME,
  type WeazeSession,
} from "@/lib/session";

export async function onboardViaQr(opts: {
  companyId: string;
  companySlug: string;
  tableId?: string | null;
  source?: string;
}): Promise<WeazeSession> {
  const existing = getSessionForCompany(opts.companySlug);
  if (existing) {
    await checkinRepository.createAutoCheckin({
      customerId: existing.customerId,
      sessionToken: existing.sessionToken,
      companyId: opts.companyId,
      tableId: opts.tableId ?? null,
      source: opts.source ?? "link",
    });
    return existing;
  }

  const profile = getLastProfile();
  const identity =
    profile?.name && profile?.whatsapp
      ? {
          name: profile.name,
          whatsapp: profile.whatsapp,
        }
      : {
          name: ANONYMOUS_NAME,
          whatsapp: getAnonymousId(),
        };

  // IP público do aparelho: permite que o mesmo usuário (celular/PC) seja
  // reconhecido ao acessar pelo mesmo IP e reutilize o perfil salvo.
  const ip = await getClientIp();

  const upserted = await customerRepository.upsertVisit({
    companyId: opts.companyId,
    name: identity.name,
    whatsapp: identity.whatsapp,
    ip,
  });

  const session: WeazeSession = {
    customerId: upserted.customerId,
    companyId: opts.companyId,
    companySlug: opts.companySlug,
    sessionToken: upserted.sessionToken,
    createdAt: Date.now(),
  };
  setSession(session);

  await checkinRepository.createAutoCheckin({
    customerId: session.customerId,
    sessionToken: session.sessionToken,
    companyId: session.companyId,
    tableId: opts.tableId ?? null,
    source: opts.source ?? "link",
  });

  return session;
}
