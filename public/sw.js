const SW_CACHE_VERSION = "amp-pwa-launch-v3-no-redirect-nav-mqktxni4"
const CACHE_NAME = `${SW_CACHE_VERSION}-runtime`
const APP_SHELL_URL = "/app"

const BYPASS_PREFIXES = [
  "/_next/static/",
  "/_next/image",
  "/api/",
]

function shouldBypass(url) {
  const pathname = new URL(url).pathname
  return BYPASS_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

function isDocumentRequest(request) {
  return (
    request.mode === "navigate" ||
    request.headers.get("accept")?.includes("text/html") === true
  )
}

async function cacheRootAppShell() {
  try {
    const response = await fetch(APP_SHELL_URL, {
      cache: "no-store",
      credentials: "include",
    })

    if (isCacheableResponse(response)) {
      const cache = await caches.open(CACHE_NAME)
      await cache.put(APP_SHELL_URL, response.clone())
    }
  } catch {
    // App shell caching is best effort.
  }
}

function isUsableDocumentResponse(response) {
  return response.ok && response.type !== "opaqueredirect"
}

function isCacheableResponse(response) {
  return (
    isUsableDocumentResponse(response) &&
    response.redirected !== true &&
    response.status < 300
  )
}

async function fetchAppShell() {
  const response = await fetch(APP_SHELL_URL, {
    cache: "no-store",
    credentials: "include",
  })

  if (isCacheableResponse(response)) {
    const cache = await caches.open(CACHE_NAME)
    await cache.put(APP_SHELL_URL, response.clone())
  }

  return response
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      await cacheRootAppShell()
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      )
      await self.clients.claim()
    })(),
  )
})

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting()
  }
})

self.addEventListener("fetch", (event) => {
  const request = event.request

  if (request.method !== "GET") {
    return
  }

  if (shouldBypass(request.url)) {
    return
  }

  if (isDocumentRequest(request)) {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request, {
            cache: "no-store",
            credentials: "include",
          })

          if (isUsableDocumentResponse(response)) {
            const pathname = new URL(request.url).pathname

            if (isCacheableResponse(response) && pathname === APP_SHELL_URL) {
              const cache = await caches.open(CACHE_NAME)
              await cache.put(APP_SHELL_URL, response.clone())
            } else if (pathname !== APP_SHELL_URL) {
              event.waitUntil(cacheRootAppShell())
            }

            return response
          }
        } catch {
          // Fall through to the app shell fallback.
        }

        try {
          const response = await fetchAppShell()

          if (isCacheableResponse(response)) {
            return response
          }
        } catch {
          // Fall through to cached app shell.
        }

        const cached = await caches.match(APP_SHELL_URL)

        if (cached) {
          return cached
        }

        try {
          const response = await fetchAppShell()

          if (isCacheableResponse(response)) {
            return response
          }
        } catch {
          // Return a non-redirect response instead of surfacing an iOS PWA error.
        }

        return new Response("App is temporarily unavailable.", {
          status: 503,
          headers: {
            "content-type": "text/plain; charset=utf-8",
          },
        })
      })(),
    )
    return
  }

  event.respondWith(fetch(request))
})
