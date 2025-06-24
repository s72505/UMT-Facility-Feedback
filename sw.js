/* ============================================================================
   UMT Facility Feedback Reporter
   Service-Worker (Offline caching)
   ---------------------------------------------------------------------------
   Comments explain each lifecycle event (install, fetch, activate) and the
   basic cache-strategy being used. Version bump the CACHE_NAME when assets
   change so old caches can be purged on 'activate'.
   ========================================================================== */


/* ───────────────────────────── Cache Config ────────────────────────────── */
const CACHE_NAME = "umt-facility-reporter-v25";   // ← update this to bust cache
const ASSETS_TO_CACHE = [
  "/",                       // root
  "/index.html",
  "/styles.css",
  "/app.js",

  /* 3rd-party assets hosted on CDNs */
  "https://unpkg.com/leaflet@1.7.1/dist/leaflet.css",
  "https://unpkg.com/leaflet@1.7.1/dist/leaflet.js",
  "https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600&display=swap",
  "https://cdn.jsdelivr.net/npm/toastify-js/src/toastify.min.css",
  "https://cdn.jsdelivr.net/npm/toastify-js",
];


/* ───────────────────────────── INSTALL EVENT ─────────────────────────────
   Fired the first time the SW is registered (or when a new version installs).
   We pre-cache the static asset list so the app works offline immediately.
   ------------------------------------------------------------------------ */
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
});


/* ───────────────────────────── FETCH EVENT ───────────────────────────────
   Intercepts network requests and tries cache first; falls back to network.
   Simple “cache-first” strategy: good for static assets, OK for basic SPA.
   ------------------------------------------------------------------------ */
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request)          // check cache
      .then((response) => response || fetch(event.request)) // else network
  );
});


/* ───────────────────────────── ACTIVATE EVENT ────────────────────────────
   Runs after install (and when the SW takes control). We delete any caches
   that don’t match the current CACHE_NAME to free space / avoid stale files.
   ------------------------------------------------------------------------ */
self.addEventListener("activate", (event) => {
  const cacheWhitelist = [CACHE_NAME];   // caches to keep

  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames.map((cacheName) => {
          if (!cacheWhitelist.includes(cacheName)) {
            return caches.delete(cacheName);  // remove old versions
          }
        })
      )
    )
  );
});
