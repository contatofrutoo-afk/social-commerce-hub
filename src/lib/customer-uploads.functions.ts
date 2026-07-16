import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const SIGNED_URL_TTL = 60 * 60 * 24 * 365; // 1 ano

const UploadInput = z.object({
  customerId: z.string().uuid(),
  sessionToken: z.string().uuid(),
  kind: z.enum(["avatar", "comment"]),
  postId: z.string().uuid().optional(),
  mimeType: z.enum(ALLOWED_MIME),
  fileName: z.string().min(1).max(200),
  // base64-encoded file content (no data: prefix)
  base64: z.string().min(1),
});

function extFromMime(mime: string, fallback: string) {
  switch (mime) {
    case "image/jpeg": return "jpg";
    case "image/png": return "png";
    case "image/webp": return "webp";
    case "image/gif": return "gif";
    default: return fallback;
  }
}

/**
 * Upload verificado de arquivo do cliente B2C (avatar ou imagem de comentário)
 * para o bucket privado `weaze-private`.
 *
 * O par (customerId, sessionToken) é validado via RPC pública `get_customer_self`
 * antes de qualquer escrita — apenas o dono da sessão consegue enviar arquivos
 * sob o próprio caminho (`avatars/{customerId}/...` ou
 * `comments/{customerId}/...`). O upload usa o service role (bypass de RLS),
 * então as policies do bucket podem restringir INSERT/SELECT a `service_role`.
 */
export const uploadCustomerFile = createServerFn({ method: "POST" })
  .inputValidator((raw) => UploadInput.parse(raw))
  .handler(async ({ data }) => {
    const { customerId, sessionToken, kind, postId, mimeType, fileName, base64 } = data;

    // Decodifica e valida tamanho
    const buffer = Buffer.from(base64, "base64");
    if (buffer.length === 0) throw new Error("Arquivo vazio");
    if (buffer.length > MAX_BYTES) throw new Error("Arquivo maior que 5MB");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Verifica que a sessão do cliente é válida (dono do customerId)
    const { data: self, error: selfErr } = await supabaseAdmin.rpc("get_customer_self", {
      _customer_id: customerId,
      _token: sessionToken,
    });
    if (selfErr) throw new Error("Sessão inválida");
    const list = Array.isArray(self) ? self : self ? [self] : [];
    if (list.length === 0) throw new Error("Sessão inválida");

    const ext = extFromMime(mimeType, (fileName.split(".").pop() ?? "jpg").toLowerCase());
    const rand = crypto.randomUUID();
    let path: string;
    if (kind === "avatar") {
      path = `avatars/${customerId}/${rand}.${ext}`;
    } else {
      if (!postId) throw new Error("postId é obrigatório para comentário");
      path = `comments/${customerId}/${postId}/${rand}.${ext}`;
    }

    const { error: upErr } = await supabaseAdmin.storage
      .from("weaze-private")
      .upload(path, buffer, { contentType: mimeType, upsert: false });
    if (upErr) throw new Error(upErr.message);

    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from("weaze-private")
      .createSignedUrl(path, SIGNED_URL_TTL);
    if (signErr || !signed?.signedUrl) throw new Error("Falha ao gerar URL");

    return { url: signed.signedUrl, path };
  });
