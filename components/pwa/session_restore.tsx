"use client"

import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef } from "react"

import { useOverlay } from "@/components/overlay"
import {
  dispatchPwaOffline,
  dispatchPwaOnline,
  PWA_ONLINE_EVENT,
} from "@/components/pwa/events"
import { isStandalonePwa } from "@/components/pwa/runtime"

type SessionRestorePayload = {
  ok?: boolean
  restored?: boolean
  session?: {
    user_uuid?: string | null
    visitor_uuid?: string | null
  }
  error?: string | null
}

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
      const response = await fetch("/api/auth/session", {
        method: "GET",
        credentials: "include",
        headers: {
          "x-amp-channel": "pwa",
        },
        cache: "no-store",
      })

      const payload = (await response.json().catch(() => null)) as
        | SessionRestorePayload
        | null

      dispatchPwaOnline()

      if (!response.ok || payload?.ok !== true || payload.restored !== true) {
        openOverlay({
          type: "link",
          source: "user",
        })
        return
      }

      router.refresh()
    } catch (error) {
      if (isNetworkFailure(error)) {
        dispatchPwaOffline()
        return
      }

      openOverlay({
        type: "link",
        source: "user",
      })
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
