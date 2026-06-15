import { AUTH_SESSION_DEBUG } from "@/core/control"

const authSessionEvents = new Set([
  "identity_conflict",
  "participant_transfer_failed",
  "visitor_cookie_set",
  "visitor_cookie_only",
  "visitor_missing",
  "visitor_repaired",
  "visitor_upsert_failed",
  "user_link_failed",
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
