// Espera a sessão do Supabase ser restaurada do storage.
//
// Ao voltar de um redirect externo (ex.: callback OAuth do Mercado Pago) a
// página carrega do zero: `getSession()` pode responder null nos primeiros
// milissegundos, antes do cliente ler o localStorage/IndexedDB. Sem essa
// espera o fluxo aborta com "Sessão expirada" mesmo com o usuário logado.
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export async function waitForSupabaseSession(timeoutMs = 5000): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session;

  return new Promise<Session | null>((resolve) => {
    let settled = false;
    let unsubscribe = () => {};

    const finish = (session: Session | null) => {
      if (settled) return;
      settled = true;
      window.clearInterval(poll);
      window.clearTimeout(timer);
      unsubscribe();
      resolve(session);
    };

    const poll = window.setInterval(async () => {
      const current = await supabase.auth.getSession().catch(() => ({ data: { session: null } }));
      if (current.data.session) finish(current.data.session);
    }, 250);

    const timer = window.setTimeout(async () => {
      const current = await supabase.auth.getSession().catch(() => ({ data: { session: null } }));
      finish(current.data.session);
    }, timeoutMs);

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) finish(session);
    });
    unsubscribe = () => authListener.subscription.unsubscribe();
  });
}
