const CACHE_NAME = "rationaltrade-shell-v4";
const OFFLINE_URL = "/offline.html";
const SHELL_URLS = [OFFLINE_URL, "/brand-logo-v2.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.mode !== "navigate") return;

  event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
});
