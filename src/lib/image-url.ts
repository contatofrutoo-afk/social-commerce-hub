/**
 * Reescreve URLs do Supabase Storage para usar o endpoint de transformação
 * `/storage/v1/render/image/...`, servindo o avatar/imagem no tamanho ideal
 * (considerando DPR) e com qualidade alta. Preserva URLs assinadas (signed)
 * e públicas; devolve a URL original quando não é do Storage.
 */
export function optimizedImageUrl(
  url: string | null | undefined,
  size: number,
  opts: { quality?: number; dpr?: number } = {},
): string | undefined {
  if (!url) return undefined;
  try {
    const dpr =
      opts.dpr ??
      (typeof window !== "undefined" && window.devicePixelRatio
        ? Math.min(3, Math.ceil(window.devicePixelRatio))
        : 2);
    const target = Math.max(64, Math.round(size * dpr));
    const quality = opts.quality ?? 85;

    const u = new URL(url);
    // Já é uma URL de render: apenas ajusta os parâmetros.
    if (u.pathname.includes("/storage/v1/render/image/")) {
      u.searchParams.set("width", String(target));
      u.searchParams.set("height", String(target));
      u.searchParams.set("resize", "cover");
      u.searchParams.set("quality", String(quality));
      return u.toString();
    }
    // Storage público: object/public -> render/image/public
    if (u.pathname.includes("/storage/v1/object/public/")) {
      u.pathname = u.pathname.replace(
        "/storage/v1/object/public/",
        "/storage/v1/render/image/public/",
      );
      u.searchParams.set("width", String(target));
      u.searchParams.set("height", String(target));
      u.searchParams.set("resize", "cover");
      u.searchParams.set("quality", String(quality));
      return u.toString();
    }
    // Storage assinado: object/sign -> render/image/sign (mantém o token)
    if (u.pathname.includes("/storage/v1/object/sign/")) {
      u.pathname = u.pathname.replace(
        "/storage/v1/object/sign/",
        "/storage/v1/render/image/sign/",
      );
      u.searchParams.set("width", String(target));
      u.searchParams.set("height", String(target));
      u.searchParams.set("resize", "cover");
      u.searchParams.set("quality", String(quality));
      return u.toString();
    }
    return url;
  } catch {
    return url;
  }
}
