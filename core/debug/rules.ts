import {
  AUTH_SESSION_DEBUG,
  DEBUG_ADMIN_ACCESS,
  DEBUG_CHAT_FLOW,
  DEBUG_LINE_WEBHOOK,
} from "@/core/control"

const alwaysReportEvents = new Set([
  "odin_smoke_entered",
  "odin_thread_create_entered",
  "odin_thread_create_response",
  "odin_thread_create_failed",
  "odin_thread_close_entered",
  "odin_thread_close_response",
  "odin_thread_close_failed",
  "line_reply_send_failed",
  "line_webhook_contact_upsert_failed",
  "line_signature_verification_failed",
  "line_webhook_event_failed",
  "line_webhook_failed",
  "chat_archive_failed",
  "chat_bootstrap_failed",
  "output_failed",
])

const deniedDiscordEvents = new Set([
  "pwa_launch_entered",
])

const lineWebhookInfoEvents = new Set([
  "line_event_normalized",
  "line_identity_resolved",
  "line_reply_blocked",
  "line_reply_send_attempt",
  "line_reply_send_success",
  "line_signature_verified",
  "line_webhook_gate_resolved",
  "line_webhook_health_check",
  "line_webhook_ignored_not_allowed",
  "line_webhook_invalid_json",
  "line_webhook_received",
  "line_webhook_reply_blocked",
  "line_webhook_route_entered",
])

const chatFlowInfoEvents = new Set([
  "app_locale_resolved",
  "chat_archive_incoming_saved",
  "chat_bootstrap_completed",
  "chat_bootstrap_failed",
  "chat_bootstrap_started",
  "chat_context_locale_resolved",
  "chat_message_locale_used",
  "chat_messages_fetch_completed",
  "chat_messages_fetch_started",
  "chat_output_bundle_built",
  "chat_quick_menu_locale_resolved",
  "chat_render_state_resolved",
  "chat_room_mode_trigger_checked",
  "chat_room_mode_updated",
  "chat_room_resolved",
  "chat_welcome_bundle_built",
  "message_archived",
  "output_route_resolved",
  "participant_created",
  "quick_menu_locale_used",
  "welcome_message_created",
])

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
  "line_webhook_identity_unresolved",
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
  "pwa_session_restore_failed",
  "pwa_session_restore_started",
  "pwa_session_restore_success",
  "pwa_session_refresh_failed",
  "pwa_session_refresh_success",
  "pwa_waiting_ui_shown",
  "session_update",
  "session_updated",
  "session_after_identity_link",
  "user_create_start",
  "user_create_success",
  "user_profile_sync_failed",
  "user_profile_sync_start",
  "user_profile_sync_success",
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
  "admin_restore_step_context_ok",
  "admin_restore_step_session_ok",
  "admin_restore_step_route_ok",
  "admin_restore_step_header_ok",
  "admin_restore_step_shell_ok",
  "admin_restore_step_data_ok",
  "admin_top_availability_resolved",
  "access_log_archived",
  "access_log_archive_failed",
  "access_log_archive_skipped",
  "admin_restore_failed",
  "notify_delivery_failed",
  "notify_delivery_sent",
  "notify_delivery_skipped",
  "proxy_request_failed",
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
  if (deniedDiscordEvents.has(event)) {
    return false
  }

  if (event === "admin_page_accessed") {
    return DEBUG_ADMIN_ACCESS
  }

  if (alwaysReportEvents.has(event)) {
    return true
  }

  if (lineWebhookInfoEvents.has(event)) {
    return DEBUG_LINE_WEBHOOK
  }

  if (chatFlowInfoEvents.has(event)) {
    return DEBUG_CHAT_FLOW
  }

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
  if (event === "admin_page_accessed") {
    return "ADMIN_ACCESS"
  }

  if (deniedDiscordEvents.has(event)) {
    return "DEBUG"
  }

  if (
    lineWebhookInfoEvents.has(event) ||
    (alwaysReportEvents.has(event) &&
      (event.startsWith("line_") ||
        event === "line_signature_verification_failed"))
  ) {
    return "LINE_WEBHOOK"
  }

  if (chatFlowInfoEvents.has(event)) {
    return "CHAT_FLOW"
  }

  if (identityEvents.has(event)) {
    return "IDENTITY"
  }

  return "AUTH_SESSION"
}
