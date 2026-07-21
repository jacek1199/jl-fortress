/* JL Fortress — service worker: cache aplikacji, offline */
const CACHE = "jlfortress-v3";
const CDN_SUPABASE = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./icon.svg",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png",
  CDN_SUPABASE
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  // Biblioteka Supabase z CDN: najpierw cache (działa offline)
  if (e.request.url === CDN_SUPABASE) {
    e.respondWith(caches.match(CDN_SUPABASE).then((hit) => hit || fetch(e.request)));
    return;
  }
  // Pozostałe zapytania zewnętrzne (w tym baza Supabase) zawsze przez sieć
  if (url.origin !== location.origin) return;
  // Strategia: sieć najpierw (świeża wersja), cache jako zapas offline
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
