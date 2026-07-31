// Onboarding silencioso da jornada do cliente via QR (QR Geral e QR da Mesa).
// Elimina a barreira de cadastro: cria a sessão em segundo plano, sem formulário.
import { customerRepository, checkinRepository } from "@/repositories";
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
          gender: profile.gender ?? null,
          ageRange: profile.ageRange ?? null,
        }
      : {
          name: ANONYMOUS_NAME,
          whatsapp: getAnonymousId(),
          gender: null,
          ageRange: null,
        };

  const upserted = await customerRepository.upsertVisit({
    companyId: opts.companyId,
    name: identity.name,
    whatsapp: identity.whatsapp,
    gender: identity.gender,
    ageRange: identity.ageRange,
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
