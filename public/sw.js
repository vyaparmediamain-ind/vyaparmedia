const CACHE_NAME = "decisional-static-1782630241830";
const STATIC_ASSETS = [
  "/",
  "/offline.html",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-512-maskable.png",
  "/apple-touch-icon.png",
];

function isStaticAssetPath(pathname) {
  return (
    pathname.startsWith("/_next/static/") ||
    /\.(?:js|css|png|jpg|jpeg|webp|gif|svg|ico|woff2?|ttf|eot|json)$/i.test(
      pathname,
    )
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET") return;
  if (url.origin !== self.location.origin) return;
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_next/webpack-hmr")
  ) {
    return;
  }
  if (request.headers.get("Authorization")) return;
  if (request.cache === "no-store") return;

  // Never cache route HTML to avoid leaking authenticated page content.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const offlinePage = await caches.match("/offline.html");
        return (
          offlinePage ||
          new Response("Offline", { status: 503, statusText: "Offline" })
        );
      }),
    );
    return;
  }

  if (!isStaticAssetPath(url.pathname)) return;

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(request)
        .then((networkResponse) => {
          const isValidResponse = networkResponse?.status === 200;
          if (isValidResponse) {
            const cacheControl =
              networkResponse.headers.get("cache-control")?.toLowerCase() || "";
            const hasSetCookie = networkResponse.headers.has("set-cookie");
            const shouldSkipCache =
              hasSetCookie ||
              cacheControl.includes("no-store") ||
              cacheControl.includes("private");

            if (!shouldSkipCache) {
              const cloned = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, cloned);
              });
            }
          }
          return networkResponse;
        })
        .catch(() => {
          return new Response("Offline", { status: 503, statusText: "Offline" });
        });
    }),
  );
});
