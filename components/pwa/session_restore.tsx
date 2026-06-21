"use client"

import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef } from "react"

import { useOverlay } from "@/components/overlay"
import {
  dispatchPwaOffline,
  dispatchPwaOnline,
  PWA_OFFLINE_EVENT,
  PWA_ONLINE_EVENT,
} from "@/components/pwa/events"
import {
  clearPwaLoginPending,
  completePwaLogin,
  isPwaLoginPending,
  pollPwaAuthSession,
  resolvePwaLoginDestination,
} from "@/components/pwa/login_completion"
import { isStandalonePwa } from "@/components/pwa/runtime"

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
