// Auto-confirma o email de um usuário recém-cadastrado (acesso direto no
// cadastro B2B), usando a service role. O Supabase pode estar com a opção
// "Confirm email" ligada — este endpoint confirma a conta para que o login
// funcione imediatamente, sem depender de clique no link de confirmação.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const ConfirmInput = z.object({ userId: z.string().min(1) });

export type AutoConfirmResult = { status: "ok" } | { status: "error"; message: string };

export const confirmSignupEmail = createServerFn({ method: "POST" })
  .inputValidator((raw) => ConfirmInput.parse(raw))
  .handler(async ({ data }): Promise<AutoConfirmResult> => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: existing, error: fetchError } = await supabaseAdmin.auth.admin.getUserById(
        data.userId,
      );
      if (fetchError || !existing?.user) {
        return { status: "error", message: "Usuário não encontrado." };
      }
      if (existing.user.email_confirmed_at) {
        return { status: "ok" };
      }
      const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
        email_confirm: true,
      });
      if (error) return { status: "error", message: error.message };
      return { status: "ok" };
    } catch (err) {
      return {
        status: "error",
        message: err instanceof Error ? err.message : "Erro ao confirmar email.",
      };
    }
  });
