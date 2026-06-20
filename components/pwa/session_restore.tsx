"use client"

import { useRouter } from "next/navigation"
import { useEffect, useRef } from "react"

import { useOverlay } from "@/components/overlay"
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

export function PwaSessionRestore() {
  const router = useRouter()
  const { openOverlay } = useOverlay()
  const started_ref = useRef(false)

  useEffect(() => {
    if (!isStandalonePwa() || started_ref.current) {
      return
    }

    started_ref.current = true
    let cancelled = false

    async function restore_session() {
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

        if (cancelled) {
          return
        }

        if (!response.ok || payload?.ok !== true || payload.restored !== true) {
          openOverlay({
            type: "link",
            source: "user",
          })
          return
        }

        router.refresh()
      } catch {
        if (!cancelled) {
          openOverlay({
            type: "link",
            source: "user",
          })
        }
      }
    }

    void restore_session()

    return () => {
      cancelled = true
    }
  }, [openOverlay, router])

  return null
}
