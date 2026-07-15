import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

async function waitForRestoredSession() {
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session;

  return new Promise<typeof data.session>((resolve) => {
    let settled = false;
    const finish = (session: typeof data.session) => {
      if (settled) return;
      settled = true;
      subscription.unsubscribe();
      resolve(session);
    };

    const timeout = window.setTimeout(async () => {
      const refreshed = await supabase.auth.getSession().catch(() => ({ data: { session: null } }));
      finish(refreshed.data.session);
    }, 900);

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      window.clearTimeout(timeout);
      finish(session);
    });
    const { subscription } = authListener;
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
