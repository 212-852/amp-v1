"use client"

import { useEffect } from "react"

import { detectAccessChannel } from "@/components/access/channel"

const HEARTBEAT_INTERVAL_MS = 30 * 1000

type ContactPresenceEventName =
  | "visible"
  | "hidden"
  | "focus"
  | "blur"
  | "pageshow"
  | "pagehide"
  | "beforeunload"
  | "heartbeat"

async function postAccess(event_name: ContactPresenceEventName, heartbeat = false) {
  await fetch(heartbeat ? "/api/contacts/heartbeat" : "/api/contacts/state", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      source_channel: detectAccessChannel(),
      event_name,
      visibility_state: document.visibilityState,
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
          void postAccess("heartbeat", true)
        }
      }, HEARTBEAT_INTERVAL_MS)
    }

    const setActive = (event_name: ContactPresenceEventName) => {
      void postAccess(event_name)
      startHeartbeat()
    }

    const setHidden = (event_name: ContactPresenceEventName) => {
      void postAccess(event_name)
      stopHeartbeat()
    }

    const syncVisibility = () => {
      if (document.visibilityState === "visible") {
        setActive("visible")
        return
      }

      setHidden("hidden")
    }

    const handleFocus = () => setActive("focus")
    const handlePageShow = () => setActive("pageshow")
    const handleBlur = () => setHidden("blur")
    const handlePageHide = () => setHidden("pagehide")
    const handleBeforeUnload = () => setHidden("beforeunload")

    syncVisibility()
    document.addEventListener("visibilitychange", syncVisibility)
    window.addEventListener("focus", handleFocus)
    window.addEventListener("pageshow", handlePageShow)
    window.addEventListener("blur", handleBlur)
    window.addEventListener("pagehide", handlePageHide)
    window.addEventListener("beforeunload", handleBeforeUnload)

    return () => {
      stopHeartbeat()
      document.removeEventListener("visibilitychange", syncVisibility)
      window.removeEventListener("focus", handleFocus)
      window.removeEventListener("pageshow", handlePageShow)
      window.removeEventListener("blur", handleBlur)
      window.removeEventListener("pagehide", handlePageHide)
      window.removeEventListener("beforeunload", handleBeforeUnload)
    }
  }, [])

  return null
}
