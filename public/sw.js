const CACHE_NAME = "vyaparmedia-static-1782630241830";
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
          // Do not return synthetic text responses for script / asset chunks to avoid SyntaxError crashes
          return Response.error();
        });
    }),
  );
});

// Clear cached resources on user logout
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "CLEAR_USER_CACHE") {
    event.waitUntil(
      caches.keys().then((keys) =>
        Promise.all(keys.map((key) => caches.delete(key))),
      ),
    );
  }
});

// ==================== WEB PUSH NOTIFICATIONS ====================

self.addEventListener("push", (event) => {
  let payload = {
    title: "VyaparMedia Update",
    message: "You have a new update.",
    url: "/dashboard",
    type: "system",
  };

  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload.message = event.data.text() || payload.message;
    }
  }

  const type = payload.type || "system";
  const isCritical =
    payload.critical === true ||
    [
      "payment",
      "payout",
      "deal_accepted",
      "dispute",
      "dispute_raised",
      "security_alert",
    ].includes(type);

  const title =
    payload.title ||
    (isCritical ? "VyaparMedia Critical Alert" : "VyaparMedia Notification");

  const options = {
    body: payload.message || payload.body || "Tap to view update.",
    icon: payload.icon || "/icon-192.png",
    badge: "/icon-192.png",
    vibrate: isCritical ? [200, 100, 200, 100, 200] : [100, 50, 100],
    requireInteraction: isCritical,
    tag: payload.tag || `vyapar-${type}`,
    renotify: true,
    data: {
      url: payload.url || (payload.dealId ? `/dashboard/deals/${payload.dealId}` : "/dashboard"),
      dealId: payload.dealId,
      type,
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  let targetUrl = event.notification.data?.url || "/dashboard";
  try {
    const parsed = new URL(targetUrl, self.location.origin);
    if (parsed.origin !== self.location.origin) {
      targetUrl = "/dashboard";
    } else {
      targetUrl = parsed.pathname + parsed.search + parsed.hash;
    }
  } catch {
    targetUrl = "/dashboard";
  }

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url && client.url.includes(self.location.origin) && "focus" in client) {
            if ("navigate" in client) {
              client.navigate(targetUrl);
            }
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      }),
  );
});
