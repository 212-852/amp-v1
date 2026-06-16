import { AUTH_SESSION_DEBUG } from "@/core/control"

const identityEvents = new Set([
  "auth_callback_received",
  "bridge_authorize_url_created",
  "bridge_callback_complete_page_shown",
  "bridge_completed",
  "bridge_insert_start",
  "bridge_insert_success",
  "bridge_poll_pending",
  "bridge_poll_success",
  "bridge_polling_started",
  "bridge_start",
  "bridge_start_api_enter",
  "bridge_start_api_failed",
  "bridge_start_api_response",
  "bridge_start_authorize_url_created",
  "bridge_start_context_resolved",
  "bridge_start_insert_attempt",
  "bridge_start_insert_success",
  "bridge_start_request",
  "bridge_start_response",
  "bridge_state_created",
  "bridge_state_valid",
  "bridge_status_pending",
  "contact_upsert_failed",
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
  "line_callback_bridge_detected",
  "line_login_button_clicked",
  "identity_unlinked",
  "line_identity_link_success",
  "line_oauth_authorize_url",
  "line_oauth_callback_received",
  "line_oauth_redirect_complete",
  "line_oauth_redirect_start",
  "line_oauth_skipped_for_liff",
  "line_oauth_started",
  "logout_success",
  "oauth_callback_code_found",
  "oauth_callback_code_missing",
  "oauth_callback_enter",
  "oauth_exchange_failed",
  "oauth_exchange_success",
  "oauth_start",
  "identity_resolved",
  "otp_environment_loaded",
  "otp_send_request",
  "otp_send_success",
  "otp_verify_request",
  "otp_verify_failed",
  "otp_verify_success",
  "pwa_reload_after_bridge",
  "pwa_bridge_start_request",
  "pwa_bridge_fetch_failed",
  "pwa_bridge_fetch_response",
  "pwa_bridge_fetch_started",
  "pwa_bridge_fetch_timeout",
  "pwa_bridge_start_failed",
  "pwa_bridge_start_success",
  "pwa_line_popup_blocked",
  "pwa_popup_connecting_page_failed",
  "pwa_popup_connecting_page_written",
  "pwa_line_popup_opened",
  "pwa_line_popup_redirected",
  "pwa_login_success_ui_shown",
  "pwa_popup_close_attempted",
  "pwa_popup_close_failed",
  "pwa_session_restored",
  "pwa_session_refresh_failed",
  "pwa_session_refresh_success",
  "pwa_waiting_ui_shown",
  "session_update",
  "session_updated",
  "session_after_identity_link",
  "user_create_start",
  "user_create_success",
  "visitor_update_start",
  "visitor_update_success",
])

const authSessionEvents = new Set([
  "auth_entry_detected",
  "identity_conflict",
  "liff_init_started",
  "liff_login_required",
  "liff_profile_resolved",
  "liff_session_start",
  "liff_session_success",
  "logout_visibility_resolved",
  "participant_transfer_failed",
  "session_restore_failed",
  "session_restore_started",
  "session_restore_success",
  "admin_page_render_started",
  "admin_page_context_resolved",
  "admin_page_session_resolved",
  "admin_page_route_resolved",
  "admin_page_header_props_ready",
  "admin_page_render_success",
  "admin_page_render_failed",
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
