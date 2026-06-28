"use client"

import { useEffect } from "react"

import {
  completePwaLogin,
  isPwaLoginPending,
  pollPwaAuthSession,
} from "@/components/pwa/login_completion"
import {
  PWA_LOGIN_PENDING_KEY,
  PWA_LOGIN_POLL_INTERVAL_MS,
  PWA_LOGIN_POLL_TIMEOUT_MS,
} from "@/components/pwa/login_pending"
import { is_pwa_display_mode } from "@/src/pwa/display_mode"
import { get_active_driver_task_modal } from "@/components/driver/task_modal_runtime"

const CHUNK_RELOAD_KEY = "amp_chunk_reload_done"
const SW_RELOAD_KEY = "amp_sw_update_reload_done"
const PWA_APP_BOOT_REDIRECT_KEY = "amp_pwa_app_boot_redirected"

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

  if (get_active_driver_task_modal()) {
    return
  }

  sessionStorage.setItem(storage_key, "1")
  window.location.reload()
}

export function isStandalonePwa() {
  return is_pwa_display_mode()
}

async function sendPwaDebug(event: string, payload: Record<string, unknown>) {
  await fetch("/api/auth/bridge/debug", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      event,
      ...payload,
    }),
  }).catch(() => null)
}

function activateWaitingWorker(registration: ServiceWorkerRegistration) {
  if (registration.waiting) {
    registration.waiting.postMessage({ type: "SKIP_WAITING" })
  }
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
      activateWaitingWorker(registration)

      registration.addEventListener("updatefound", () => {
        const worker = registration.installing

        if (!worker) {
          return
        }

        worker.addEventListener("statechange", () => {
          if (worker.state === "installed") {
            activateWaitingWorker(registration)
          }
        })
      })

      void registration.update()

      if (isStandalonePwa()) {
        window.setInterval(() => {
          void registration.update()
        }, 60 * 60 * 1000)
      }
    })
    .catch(() => undefined)
}

function redirectOldPwaAppBootUrl() {
  if (!isStandalonePwa()) {
    return false
  }

  if (window.location.pathname !== "/app") {
    return false
  }

  if (sessionStorage.getItem(PWA_APP_BOOT_REDIRECT_KEY)) {
    return false
  }

  sessionStorage.setItem(PWA_APP_BOOT_REDIRECT_KEY, "1")
  window.location.replace("/")
  return true
}

export function PwaRuntime() {
  useEffect(() => {
    sessionStorage.removeItem(CHUNK_RELOAD_KEY)
    sessionStorage.removeItem(SW_RELOAD_KEY)

    if (isStandalonePwa()) {
      void sendPwaDebug("pwa_launch_entered", {
        pathname: window.location.pathname,
        search: window.location.search,
        referrer: document.referrer || null,
        display_mode: "standalone",
      })
    }

    if (redirectOldPwaAppBootUrl()) {
      return
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

    let login_poll_interval: number | null = null
    let login_poll_timeout: number | null = null

    const stop_login_polling = () => {
      if (login_poll_interval) {
        window.clearInterval(login_poll_interval)
        login_poll_interval = null
      }

      if (login_poll_timeout) {
        window.clearTimeout(login_poll_timeout)
        login_poll_timeout = null
      }
    }

    const check_login_status = (source: string) => {
      if (!isPwaLoginPending()) {
        stop_login_polling()
        return
      }

      const bridge_uuid = localStorage.getItem("amp_line_bridge_uuid")

      if (source === "focus") {
        void sendPwaDebug("pwa_login_focus_check", { bridge_uuid })
      } else if (source === "pageshow") {
        void sendPwaDebug("pwa_login_pageshow_check", { bridge_uuid })
      }

      void sendPwaDebug("pwa_login_polling_tick", { bridge_uuid, source })

      void pollPwaAuthSession()
        .then((result) => {
          if (!result.user_uuid) {
            return
          }

          stop_login_polling()
          completePwaLogin({
            user_uuid: result.user_uuid,
            route_path: result.route_path,
            source,
            bridge_uuid,
            on_debug: (event, payload) => {
              void sendPwaDebug(event, payload)
            },
          })
        })
        .catch(() => null)
    }

    const start_login_polling_if_pending = (source: string) => {
      if (!isPwaLoginPending()) {
        return
      }

      const bridge_uuid = localStorage.getItem("amp_line_bridge_uuid")
      check_login_status(source)

      if (login_poll_interval) {
        return
      }

      void sendPwaDebug("pwa_login_polling_started", {
        bridge_uuid,
        interval_ms: PWA_LOGIN_POLL_INTERVAL_MS,
        timeout_ms: PWA_LOGIN_POLL_TIMEOUT_MS,
        source,
      })

      login_poll_interval = window.setInterval(() => {
        check_login_status("runtime_interval")
      }, PWA_LOGIN_POLL_INTERVAL_MS)

      login_poll_timeout = window.setTimeout(() => {
        stop_login_polling()
        localStorage.removeItem(PWA_LOGIN_PENDING_KEY)
        void sendPwaDebug("pwa_login_polling_timeout", {
          bridge_uuid,
          timeout_ms: PWA_LOGIN_POLL_TIMEOUT_MS,
          source,
        })
      }, PWA_LOGIN_POLL_TIMEOUT_MS)
    }

    const onFocus = () => start_login_polling_if_pending("focus")
    const onPageShow = () => start_login_polling_if_pending("pageshow")
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        start_login_polling_if_pending("visibilitychange")
      }
    }

    window.addEventListener("error", onError)
    window.addEventListener("unhandledrejection", onRejection)
    window.addEventListener("focus", onFocus)
    window.addEventListener("pageshow", onPageShow)
    document.addEventListener("visibilitychange", onVisibilityChange)
    start_login_polling_if_pending("mount")

    if (process.env.NODE_ENV === "production") {
      registerServiceWorker()
    }

    return () => {
      stop_login_polling()
      window.removeEventListener("error", onError)
      window.removeEventListener("unhandledrejection", onRejection)
      window.removeEventListener("focus", onFocus)
      window.removeEventListener("pageshow", onPageShow)
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [])

  return null
}
