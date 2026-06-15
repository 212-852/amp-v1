import { AUTH_SESSION_DEBUG } from "@/core/control"

const identityEvents = new Set([
  "auth_callback_received",
  "google_code_exchange_failed",
  "google_code_exchange_success",
  "identity_link_failed",
  "identity_link_started",
  "identity_link_success",
  "identity_unlinked",
  "oauth_callback_code_found",
  "oauth_callback_code_missing",
  "oauth_callback_enter",
  "oauth_exchange_failed",
  "oauth_exchange_success",
  "oauth_start",
])

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
    (authSessionEvents.has(event) ||
      identityEvents.has(event) ||
      isUnexpectedEvent(event))
  )
}

export function resolveDebugTitle(event: string) {
  if (identityEvents.has(event)) {
    return "IDENTITY"
  }

  return "AUTH_SESSION"
}
