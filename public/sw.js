/*
 * WEAZE — Service Worker (PWA)
 *
 * Segurança: cache apenas de arquivos públicos e estáticos (JS/CSS/imagens/fontes/
 * manifest/ícones). NUNCA cacheia navegação (HTML/SSR), server functions do
 * TanStack Start, APIs, autenticação ou qualquer dado dinâmico/sensível.
 *
 * Atualização: a cada nova versão o SW substitui o cache antigo e assume o
 * controle imediatamente (skipWaiting + clientsClaim) — sem reinstalação.
 */

const CACHE = "weaze-static-v3";

const PRECACHE = [
  "/manifest.webmanifest",
  "/favicon.png",
  "/apple-touch-icon.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-512-maskable.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE).catch(() => {}))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Só o mesmo domínio. Supabase, APIs externas e fontes: sempre rede direta,
  // para que login/cadastro nunca dependam de nada em cache.
  if (url.origin !== self.location.origin) return;

  // Navegação (HTML/SSR), server functions, APIs, auth e bundles hasheados
  // nunca passam pelo cache — no app instalado isso causaria versões antigas
  // do JS (quebrando acesso e criação de contas B2B após um novo deploy).
  if (req.destination === "document" || req.destination === "navigate") return;
  if (
    url.pathname.includes("_server") ||
    url.pathname.includes("/api/") ||
    url.pathname.startsWith("/auth") ||
    url.pathname.startsWith("/assets/")
  ) {
    return;
  }

  // Apenas ícones e manifest ficam em cache (offline-friendly, sem risco).
  const cacheable =
    url.pathname.startsWith("/icons/") ||
    PRECACHE.includes(url.pathname) ||
    req.destination === "manifest";

  if (!cacheable) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches
              .open(CACHE)
              .then((cache) => cache.put(req, copy))
              .catch(() => {});
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});

