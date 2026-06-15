import { AUTH_SESSION_DEBUG } from "@/core/control"

const identityEvents = new Set([
  "auth_callback_received",
  "contact_upsert_failed",
  "email_code_sent",
  "google_code_exchange_failed",
  "google_code_exchange_success",
  "google_oauth_callback_received",
  "google_oauth_start",
  "google_oauth_state_failed",
  "google_token_exchange_failed",
  "google_token_exchange_success",
  "identity_link_failed",
  "identity_link_started",
  "identity_link_success",
  "identity_upsert_payload",
  "identity_unlinked",
  "logout_success",
  "oauth_callback_code_found",
  "oauth_callback_code_missing",
  "oauth_callback_enter",
  "oauth_exchange_failed",
  "oauth_exchange_success",
  "oauth_start",
  "session_after_identity_link",
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
  if (identityEvents.has(event)) {
    if (!AUTH_SESSION_DEBUG) {
      console.warn("[IDENTITY_DEBUG_AUTH_SESSION_DEBUG_FALSE]", {
        event,
        reason: "IDENTITY debug is allowed while AUTH_SESSION_DEBUG is false",
      })
    }

    return true
  }

  return AUTH_SESSION_DEBUG && (authSessionEvents.has(event) || isUnexpectedEvent(event))
}

export function resolveDebugTitle(event: string) {
  if (identityEvents.has(event)) {
    return "IDENTITY"
  }

  return "AUTH_SESSION"
}
