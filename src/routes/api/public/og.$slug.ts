import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { buildOgPng } from "@/lib/og-image.server";

/**
 * Imagem de preview do link de cada estabelecimento (/c/{slug}).
 * Endpoint público: os crawlers do WhatsApp/Facebook/X não enviam sessão.
 */
export const Route = createFileRoute("/api/public/og/$slug")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        try {
          const { data } = await supabase.rpc("get_company_public", { _slug: params.slug });
          const row: any = Array.isArray(data) ? data[0] : data;
          const logoUrl: string | undefined = row?.logo_url;
          if (!logoUrl || !/^https?:\/\//.test(logoUrl)) {
            return new Response("Not found", { status: 404 });
          }

          const res = await fetch(logoUrl);
          if (!res.ok) return new Response("Not found", { status: 404 });
          const bytes = new Uint8Array(await res.arrayBuffer());

          const png = buildOgPng(bytes, row?.primary_color || "#ffffff");
          if (!png) {
            // Formato não suportado: devolve o arquivo original.
            return new Response(bytes, {
              headers: {
                "content-type": res.headers.get("content-type") ?? "image/png",
                "cache-control": "public, max-age=3600",
              },
            });
          }

          return new Response(png, {
            headers: {
              "content-type": "image/png",
              "cache-control": "public, max-age=3600",
            },
          });
        } catch {
          return new Response("Error", { status: 500 });
        }
      },
    },
  },
});
