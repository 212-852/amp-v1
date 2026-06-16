const CACHE_VERSION = "amp-mqgmss0k"

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

self.addEventListener("install", () => {
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.map((key) => caches.delete(key)))
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
      fetch(request, {
        cache: "no-store",
      }),
    )
    return
  }

  event.respondWith(fetch(request))
})
