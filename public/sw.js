const CACHE_NAME = "diario-auto-v4";
const BASE = "/";

const CORE_ASSETS = [BASE, BASE + "manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  // Navigazioni (HTML) e i bundle JS/CSS: sempre network-first, per non
  // servire mai una shell vecchia che punta a chunk con hash non più
  // esistenti dopo un deploy. Si va in cache solo se offline.
  const isNavigation = event.request.mode === "navigate";
  const url = new URL(event.request.url);
  const isAppShellAsset = url.pathname.endsWith(".html") || url.pathname === "/";

  if (isNavigation || isAppShellAsset) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200 && response.type === "basic") {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request)),
    );
    return;
  }

  // Asset con hash nel nome (JS/CSS/immagini generati da Vite): cache-first,
  // sono content-addressed quindi non diventano mai "stale".
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response && response.status === 200 && response.type === "basic") {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    }),
  );
});
