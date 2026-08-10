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

const STATIC_DEST = new Set(["script", "style", "image", "font", "manifest"]);

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Navegação (HTML/SSR) e dados dinâmicos: nunca em cache.
  if (req.destination === "document" || req.destination === "navigate") return;

  // Server functions / APIs / auth: nunca tocar.
  if (
    url.pathname.includes("_server_fn") ||
    url.pathname.includes("/api/") ||
    url.pathname.startsWith("/auth")
  ) {
    return;
  }

  // Cross-origin: apenas fontes públicas do Google (com CORS). Nada mais.
  if (url.origin !== self.location.origin) {
    if (url.hostname !== "fonts.googleapis.com" && url.hostname !== "fonts.gstatic.com") {
      return;
    }
  }

  const isStatic =
    STATIC_DEST.has(req.destination) ||
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/icons/");

  if (!isStatic) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          if (res && res.ok && !res.headers.get("set-cookie")) {
            const copy = res.clone();
            caches
              .open(CACHE)
              .then((cache) => cache.put(req, copy))
              .catch(() => {});
          }
          return res;
        })
        .catch(() => cached);
    }),
  );
});
