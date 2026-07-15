import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

async function waitForRestoredSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session;

  return new Promise<Session | null>((resolve) => {
    let settled = false;
    let unsubscribe = () => {};
    const timeout = window.setTimeout(async () => {
      const refreshed = await supabase.auth.getSession().catch(() => ({ data: { session: null } }));
      finish(refreshed.data.session);
    }, 900);

    const finish = (session: Session | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      unsubscribe();
      resolve(session);
    };

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      finish(session);
    });
    unsubscribe = () => authListener.subscription.unsubscribe();
  });
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const session = await waitForRestoredSession();
    if (!session) {
      throw redirect({
        to: "/auth",
        search: { redirect: location.href } as never,
      });
    }
    return { user: session.user };
  },
  component: () => <Outlet />,
});
