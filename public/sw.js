// OzuHelper service worker: çevrimdışı açılış için.
// Sayfalar önce ağdan istenir (yeni yayın hemen görünsün), ağ yoksa son kopya verilir.
// /_next/static dosyaları adında sürüm taşıdığı için önbellekten verilir.
const VERSION = "v3";
const PAGES = `ozuhelper-sayfa-${VERSION}`;
const STATIC = `ozuhelper-statik-${VERSION}`;
const START = "/ozyegin/";
const MAX_STATIC = 300;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PAGES)
      .then((c) => c.addAll([START, "/manifest.webmanifest"]))
      .catch(() => {})
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== PAGES && k !== STATIC).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function trim(cache) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MAX_STATIC; i++) await cache.delete(keys[i]);
}

async function networkFirst(request) {
  const cache = await caches.open(PAGES);
  try {
    // no-cache: tarayıcının kendi kopyasını değil sunucudaki hâli sorar (ETag ile, 304 dönerse bedava).
    // GitHub Pages sayfaları 10 dakika önbelleğe aldırıyor; bu olmadan yeni yayın geç görünüyordu.
    const response = await fetch(request, { cache: "no-cache" });
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const hit = await cache.match(request, { ignoreSearch: request.mode === "navigate" });
    if (hit) return hit;
    if (request.mode === "navigate") {
      const start = await cache.match(START);
      if (start) return start;
    }
    return Response.error();
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) {
    await cache.put(request, response.clone());
    trim(cache);
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(cacheFirst(request));
    return;
  }
  event.respondWith(networkFirst(request));
});

// Sayfa, service worker devreye girmeden önce yüklediği dosyaları bildirir; ilk ziyarette de çevrimdışı açılsın.
self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || data.type !== "cache-urls" || !Array.isArray(data.urls)) return;
  event.waitUntil(
    Promise.all(
      data.urls.map(async (u) => {
        try {
          const url = new URL(u, self.location.origin);
          if (url.origin !== self.location.origin) return;
          const isStatic = url.pathname.startsWith("/_next/static/");
          const cache = await caches.open(isStatic ? STATIC : PAGES);
          if (await cache.match(url.href)) return;
          const response = await fetch(url.href);
          if (response.ok) await cache.put(url.href, response);
        } catch {
          /* çevrimdışı ya da erişilemedi */
        }
      }),
    ),
  );
});
