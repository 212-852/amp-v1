import { AUTH_SESSION_DEBUG } from "@/core/control"

const authSessionEvents = new Set([
  "google_callback_failed",
  "google_identity_conflict",
  "identity_conflict",
  "participant_transfer_failed",
  "visitor_cookie_set",
  "visitor_cookie_only",
  "visitor_missing",
  "visitor_missing_on_google_callback",
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
