import { AUTH_SESSION_DEBUG } from "@/core/control"

const identityEvents = new Set([
  "auth_callback_received",
  "contact_upsert_failed",
  "email_otp_sent",
  "email_auth_client_config",
  "email_provider_config",
  "email_send_method",
  "email_send_request",
  "email_send_result",
  "email_minimal_otp_start_result",
  "email_minimal_otp_verify_result",
  "email_user_exists_after_send",
  "email_verify_attempt",
  "email_verify_attempt_result",
  "email_verify_payload",
  "email_verify_api_response",
  "email_verify_request_received",
  "email_verify_result",
  "email_verify_success",
  "email_session_update",
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
  "identity_lookup_result",
  "identity_lookup_start",
  "identity_email_lookup_result",
  "identity_email_lookup_start",
  "identity_upsert_payload",
  "identity_upsert_start",
  "identity_upsert_success",
  "identity_user_resolve_result",
  "identity_unlinked",
  "logout_success",
  "oauth_callback_code_found",
  "oauth_callback_code_missing",
  "oauth_callback_enter",
  "oauth_exchange_failed",
  "oauth_exchange_success",
  "oauth_start",
  "session_update",
  "session_after_identity_link",
  "user_create_start",
  "user_create_success",
  "visitor_update_start",
  "visitor_update_success",
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
