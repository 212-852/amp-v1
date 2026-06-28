"use client"

import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef } from "react"

import { useOverlay } from "@/components/overlay"
import { get_active_driver_task_modal } from "@/components/driver/task_modal_runtime"
import {
  dispatchPwaOffline,
  dispatchPwaOnline,
  PWA_ONLINE_EVENT,
} from "@/components/pwa/events"
import {
  clearPwaLoginPending,
  isPwaLoginPending,
  pollPwaAuthSession,
  resolvePwaLoginDestination,
} from "@/components/pwa/login_completion"
import { isStandalonePwa } from "@/components/pwa/runtime"
import { send_ocr_debug } from "@/core/ocr/debug"

function isNetworkFailure(error: unknown) {
  return (
    error instanceof TypeError ||
    (error instanceof Error &&
      (error.message.includes("Failed to fetch") ||
        error.message.includes("NetworkError") ||
        error.message.includes("Load failed")))
  )
}

export function PwaSessionRestore() {
  const router = useRouter()
  const { openOverlay } = useOverlay()
  const started_ref = useRef(false)
  const restoring_ref = useRef(false)

  const restore_session = useCallback(async () => {
    if (!isStandalonePwa() || restoring_ref.current) {
      return
    }

    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      dispatchPwaOffline()
      return
    }

    restoring_ref.current = true

    try {
      const result = await pollPwaAuthSession()

      dispatchPwaOnline()

      if (result.user_uuid) {
        clearPwaLoginPending()
        const destination = resolvePwaLoginDestination(result.route_path)
        const active_driver_task = get_active_driver_task_modal()

        if (active_driver_task) {
          void send_ocr_debug("OCR_NAVIGATION_BLOCKED_DURING_OCR", {
            request_id: "pwa-session-restore",
            component_instance_id: "pwa-session-restore",
            document_type: "driver_license_front",
            scan_state: "active",
            camera_state: "unknown",
            action: window.location.pathname !== destination ? "replace" : "refresh",
            from: window.location.pathname,
            to: destination,
            reason: "pwa_session_restore_driver_task_open",
            task_key: active_driver_task,
          })
          return
        }

        if (window.location.pathname !== destination) {
          window.location.replace(destination)
          return
        }

        router.refresh()
        return
      }

      if (isPwaLoginPending()) {
        return
      }

      if (!result.ok || !result.restored) {
        openOverlay({
          type: "link",
          source: "user",
        })
      }
    } catch (error) {
      if (isNetworkFailure(error)) {
        dispatchPwaOffline()
        return
      }

      if (!isPwaLoginPending()) {
        openOverlay({
          type: "link",
          source: "user",
        })
      }
    } finally {
      restoring_ref.current = false
    }
  }, [openOverlay, router])

  useEffect(() => {
    if (!isStandalonePwa() || started_ref.current) {
      return
    }

    started_ref.current = true
    void restore_session()

    function handle_online() {
      void restore_session()
    }

    window.addEventListener(PWA_ONLINE_EVENT, handle_online)
    window.addEventListener("online", handle_online)

    return () => {
      window.removeEventListener(PWA_ONLINE_EVENT, handle_online)
      window.removeEventListener("online", handle_online)
    }
  }, [restore_session])

  return null
}
