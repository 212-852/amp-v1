"use client"

import { useEffect } from "react"

import { detectAccessChannel } from "@/components/access/channel"

const HEARTBEAT_INTERVAL_MS = 30 * 1000

async function postAccess(state: "active" | "hidden", heartbeat = false) {
  await fetch("/api/visitors/state", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      source_channel: detectAccessChannel(),
      state,
      receive: true,
      heartbeat,
    }),
    cache: "no-store",
    keepalive: true,
  }).catch(() => undefined)
}

export function AccessPresence() {
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null
    let accessSynced = false

    const stopHeartbeat = () => {
      if (intervalId) {
        clearInterval(intervalId)
        intervalId = null
      }
    }

    const startHeartbeat = () => {
      if (intervalId || document.visibilityState !== "visible") {
        return
      }

      intervalId = setInterval(() => {
        if (document.visibilityState === "visible") {
          void postAccess("active", true)
        }
      }, HEARTBEAT_INTERVAL_MS)
    }

    const syncVisibility = () => {
      if (document.visibilityState === "visible") {
        void postAccess("active")
        accessSynced = true
        startHeartbeat()
        return
      }

      if (accessSynced) {
        void postAccess("hidden")
      }
      stopHeartbeat()
    }

    syncVisibility()
    document.addEventListener("visibilitychange", syncVisibility)

    return () => {
      stopHeartbeat()
      document.removeEventListener("visibilitychange", syncVisibility)
    }
  }, [])

  return null
}
