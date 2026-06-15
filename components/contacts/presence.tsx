"use client"

import { useEffect } from "react"

const HEARTBEAT_INTERVAL_MS = 30 * 1000

function resolveChannel() {
  const userAgent = navigator.userAgent.toLowerCase()
  const standaloneNavigator = navigator as Navigator & {
    standalone?: boolean
  }

  if (userAgent.includes("line")) {
    return "liff"
  }

  if (
    window.matchMedia("(display-mode: standalone)").matches ||
    standaloneNavigator.standalone === true
  ) {
    return "pwa"
  }

  return "web"
}

async function postContact(path: string, state: "active" | "hidden") {
  await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "push",
      channel: resolveChannel(),
      state,
    }),
    cache: "no-store",
    keepalive: true,
  }).catch(() => undefined)
}

export function ContactPresence() {
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null

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
          void postContact("/api/contacts/heartbeat", "active")
        }
      }, HEARTBEAT_INTERVAL_MS)
    }

    const syncVisibility = () => {
      if (document.visibilityState === "visible") {
        void postContact("/api/contacts", "active")
        startHeartbeat()
        return
      }

      void postContact("/api/contacts", "hidden")
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
