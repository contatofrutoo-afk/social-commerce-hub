import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const ALLOWED_IMAGE_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
const ALLOWED_VIDEO_MIME = ["video/mp4", "video/webm", "video/quicktime", "video/x-m4v"] as const;
const ALLOWED_ALL_MIME = [...ALLOWED_IMAGE_MIME, ...ALLOWED_VIDEO_MIME] as const;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50MB
const SIGNED_URL_TTL = 60 * 60 * 24 * 365; // 1 ano

const UploadInput = z.object({
  customerId: z.string().uuid(),
  sessionToken: z.string().uuid(),
  kind: z.enum(["avatar", "comment"]),
  postId: z.string().uuid().optional(),
  mimeType: z.enum(ALLOWED_ALL_MIME),
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
    case "video/mp4": return "mp4";
    case "video/webm": return "webm";
    case "video/quicktime": return "mov";
    case "video/x-m4v": return "m4v";
    default: return fallback;
  }
}

/**
 * Upload verificado de arquivo do cliente B2C.
 *
 * - `avatar` e `comment`: bucket privado `weaze-private`, retorna signed URL.
 *
 * O par (customerId, sessionToken) é validado via RPC `get_customer_self`
 * antes de qualquer escrita — apenas o dono da sessão consegue enviar arquivos.
 */
export const uploadCustomerFile = createServerFn({ method: "POST" })
  .inputValidator((raw) => UploadInput.parse(raw))
  .handler(async ({ data }) => {
    const { customerId, sessionToken, kind, postId, mimeType, fileName, base64 } = data;

    const isVideo = (ALLOWED_VIDEO_MIME as readonly string[]).includes(mimeType);
    if (isVideo) {
      throw new Error("Vídeo não suportado para avatar/comentário");
    }

    // Decodifica e valida tamanho
    const buffer = Buffer.from(base64, "base64");
    if (buffer.length === 0) throw new Error("Arquivo vazio");
    const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
    if (buffer.length > maxBytes) {
      throw new Error(`Arquivo maior que ${isVideo ? "50MB" : "10MB"}`);
    }

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
