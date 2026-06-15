import { AUTH_SESSION_DEBUG } from "@/core/control"

const authSessionEvents = new Set([
  "visitor_cookie_set",
  "visitor_cookie_only",
  "visitor_repaired",
  "visitor_upsert_failed",
  "session_failed",
])

function isUnexpectedEvent(event: string) {
  return event.includes("failed") || event.includes("error")
}

export function shouldSendAuthSessionDebug(event: string) {
  return (
    AUTH_SESSION_DEBUG &&
    (authSessionEvents.has(event) || isUnexpectedEvent(event))
  )
}
