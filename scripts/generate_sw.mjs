import { writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root_dir = join(dirname(fileURLToPath(import.meta.url)), "..")
const build_id =
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ??
  process.env.BUILD_ID ??
  Date.now().toString(36)

const sw_source = `const SW_CACHE_VERSION = "amp-pwa-launch-v2-${build_id}"
const CACHE_NAME = \`\${SW_CACHE_VERSION}-runtime\`

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
    const response = await fetch("/", { cache: "no-store" })

    if (response.ok) {
      const cache = await caches.open(CACHE_NAME)
      await cache.put("/", response.clone())
    }
  } catch {
    // App shell caching is best effort.
  }
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
          })

          if (response.ok) {
            const pathname = new URL(request.url).pathname

            if (pathname === "/") {
              const cache = await caches.open(CACHE_NAME)
              await cache.put("/", response.clone())
            } else {
              event.waitUntil(cacheRootAppShell())
            }

            return response
          }
        } catch {
          // Fall through to the app shell fallback.
        }

        const cached = await caches.match("/")

        if (cached) {
          return cached
        }

        return fetch("/", { cache: "no-store" })
      })(),
    )
    return
  }

  event.respondWith(fetch(request))
})
`

writeFileSync(join(root_dir, "public", "sw.js"), sw_source, "utf8")
console.log(`Generated public/sw.js with amp-${build_id}`)
