const SW_VERSION = "v5"
const BUILD_ID = "mqnsrey2"
const CACHE_NAME = "amp-pwa-" + SW_VERSION + "-" + BUILD_ID
const LEGACY_CACHE_PREFIX = "amp-pwa-"
const APP_SHELL_URL = "/"

const BYPASS_PATHS = [
  "/api/chat/room",
  "/api/auth/session",
]

const BYPASS_PREFIXES = [
  "/_next/static/",
  "/_next/image",
  "/admin",
  "/api/auth/",
  "/api/chat/",
  "/api/",
]

const OFFLINE_HTML = [
  "<!doctype html>",
  '<html lang="ja">',
  "<head>",
  '<meta charset="utf-8" />',
  '<meta name="viewport" content="width=device-width, initial-scale=1" />',
  "<title>PET TAXI</title>",
  "<style>",
  "body{margin:0;min-height:100dvh;display:flex;align-items:center;justify-content:center;background:#f5e8d5;color:#3d2a19;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;padding:24px;}",
  ".card{max-width:360px;width:100%;padding:28px 24px;border-radius:24px;background:#fffdf9;border:1px solid #eadfce;text-align:center;box-shadow:0 8px 24px rgba(0,0,0,.06);}",
  "h1{margin:0 0 12px;font-size:20px;}",
  "p{margin:0;font-size:14px;line-height:1.7;color:#6a5a50;}",
  "</style>",
  "</head>",
  "<body>",
  '<div class="card">',
  "<h1>オフライン</h1>",
  "<p>ネットワークに接続できません。<br />接続が復旧すると自動的に再試行します。</p>",
  "</div>",
  "</body>",
  "</html>",
].join("")

function isSupabaseHost(hostname) {
  return hostname.endsWith(".supabase.co")
}

function shouldBypass(url) {
  const parsed_url = new URL(url)
  const pathname = parsed_url.pathname

  if (parsed_url.protocol === "ws:" || parsed_url.protocol === "wss:") {
    return true
  }

  if (isSupabaseHost(parsed_url.hostname)) {
    return true
  }

  if (BYPASS_PATHS.includes(pathname)) {
    return true
  }

  return BYPASS_PREFIXES.some(function (prefix) {
    return pathname === prefix.replace(/\/$/, "") || pathname.startsWith(prefix)
  })
}

function isDocumentRequest(request) {
  return (
    request.mode === "navigate" ||
    request.headers.get("accept")?.includes("text/html") === true
  )
}

function offlineResponse() {
  return new Response(OFFLINE_HTML, {
    status: 503,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  })
}

async function purgeLegacyCaches() {
  const keys = await caches.keys()

  await Promise.all(
    keys
      .filter(function (key) {
        return key.startsWith(LEGACY_CACHE_PREFIX) && key !== CACHE_NAME
      })
      .map(function (key) {
        return caches.delete(key)
      }),
  )
}

async function maybeCacheAppShell(request, response) {
  const pathname = new URL(request.url).pathname

  if (pathname !== APP_SHELL_URL) {
    return
  }

  if (!response.ok || response.redirected || response.type === "opaqueredirect") {
    return
  }

  try {
    const cache = await caches.open(CACHE_NAME)
    await cache.put(APP_SHELL_URL, response.clone())
  } catch {
    // Cache update is best effort only.
  }
}

async function handleDocumentRequest(request) {
  try {
    const response = await fetch(request, {
      cache: "no-store",
      credentials: "include",
    })

    if (response) {
      maybeCacheAppShell(request, response)
      return response
    }
  } catch {
    // Network unavailable — fall back to offline shell only.
  }

  try {
    const cached = await caches.match(APP_SHELL_URL)

    if (cached) {
      return cached
    }
  } catch {
    // Ignore cache read errors.
  }

  return offlineResponse()
}

self.addEventListener("install", function (event) {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener("activate", function (event) {
  event.waitUntil(
    (async function () {
      await purgeLegacyCaches()
      await self.clients.claim()
    })(),
  )
})

self.addEventListener("message", function (event) {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting()
  }
})

function parsePushPayload(event) {
  if (!event.data) {
    return {
      title: "コンシェルジュ対応が必要です",
      body: "新しいメッセージが届きました。",
      data: {},
    }
  }

  try {
    return event.data.json()
  } catch {
    return {
      title: "コンシェルジュ対応が必要です",
      body: event.data.text(),
      data: {},
    }
  }
}

self.addEventListener("push", function (event) {
  const payload = parsePushPayload(event)
  const title = payload.title || "コンシェルジュ対応が必要です"
  const options = {
    body: payload.body || "新しいメッセージが届きました。",
    data: payload.data || {},
    icon: "/images/icon_192.png",
    badge: "/images/icon_192.png",
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener("notificationclick", function (event) {
  event.notification.close()

  const room_url = event.notification.data && event.notification.data.room_url
  const target_url = room_url || "/admin"

  event.waitUntil(
    (async function () {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      })

      for (const client of windows) {
        if ("focus" in client) {
          await client.focus()
          if ("navigate" in client) {
            return client.navigate(target_url)
          }
          return
        }
      }

      return self.clients.openWindow(target_url)
    })(),
  )
})

self.addEventListener("fetch", function (event) {
  const request = event.request

  if (request.method !== "GET") {
    return
  }

  if (shouldBypass(request.url)) {
    return
  }

  if (!isDocumentRequest(request)) {
    return
  }

  event.respondWith(handleDocumentRequest(request))
})
