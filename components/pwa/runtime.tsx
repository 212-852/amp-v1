"use client"

import { useEffect } from "react"

const CHUNK_RELOAD_KEY = "amp_chunk_reload_done"
const SW_RELOAD_KEY = "amp_sw_update_reload_done"

function isChunkLoadError(reason: unknown) {
  const message =
    reason instanceof Error
      ? `${reason.name} ${reason.message}`
      : String(reason ?? "")

  return (
    message.includes("ChunkLoadError") ||
    message.includes("Loading chunk") ||
    message.includes("Failed to load chunk") ||
    message.includes("/_next/static/chunks/")
  )
}

function reloadOnce(storage_key: string) {
  if (typeof window === "undefined") {
    return
  }

  if (sessionStorage.getItem(storage_key)) {
    return
  }

  sessionStorage.setItem(storage_key, "1")
  window.location.reload()
}

function isStandalonePwa() {
  if (typeof window === "undefined") {
    return false
  }

  const standaloneNavigator = navigator as Navigator & {
    standalone?: boolean
  }

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    standaloneNavigator.standalone === true
  )
}

async function sendPwaDebug(event: string, payload: Record<string, unknown>) {
  await fetch("/api/auth/bridge/debug", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      event,
      payload,
    }),
  }).catch(() => null)
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return
  }

  let refreshing = false

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) {
      return
    }

    refreshing = true
    reloadOnce(SW_RELOAD_KEY)
  })

  void navigator.serviceWorker
    .register("/sw.js", { scope: "/", updateViaCache: "none" })
    .then((registration) => {
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing

        if (!worker) {
          return
        }

        worker.addEventListener("statechange", () => {
          if (
            worker.state === "installed" &&
            navigator.serviceWorker.controller
          ) {
            worker.postMessage({ type: "SKIP_WAITING" })
          }
        })
      })

      if (registration.waiting && navigator.serviceWorker.controller) {
        registration.waiting.postMessage({ type: "SKIP_WAITING" })
      }

      void registration.update()
    })
    .catch(() => undefined)
}

export function PwaRuntime() {
  useEffect(() => {
    sessionStorage.removeItem(CHUNK_RELOAD_KEY)

    if (isStandalonePwa()) {
      void sendPwaDebug("pwa_launch_entered", {
        pathname: window.location.pathname,
        search: window.location.search,
        referrer: document.referrer || null,
        display_mode: "standalone",
      })
    }

    const onError = (event: ErrorEvent) => {
      if (isChunkLoadError(event.error ?? event.message)) {
        reloadOnce(CHUNK_RELOAD_KEY)
      }
    }

    const onRejection = (event: PromiseRejectionEvent) => {
      if (isChunkLoadError(event.reason)) {
        reloadOnce(CHUNK_RELOAD_KEY)
      }
    }

    window.addEventListener("error", onError)
    window.addEventListener("unhandledrejection", onRejection)

    if (process.env.NODE_ENV === "production") {
      registerServiceWorker()
    }

    return () => {
      window.removeEventListener("error", onError)
      window.removeEventListener("unhandledrejection", onRejection)
    }
  }, [])

  return null
}
