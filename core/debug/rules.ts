import {
  AUTH_SESSION_DEBUG,
  DEBUG_ADMIN_ACCESS,
  DEBUG_CHAT_FLOW,
  CHAT_REALTIME_DEBUG,
  DEBUG_CONTACT_PRESENCE,
  DEBUG_LINE_WEBHOOK,
  DEBUG_NOTIFY,
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
  "chat_archive_insert_error",
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
  "chat_archive_insert_start",
  "chat_archive_insert_success",
  "chat_archive_insert_error",
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
  "message_initial_fetch_error",
  "output_route_resolved",
  "participant_created",
  "quick_menu_locale_used",
  "welcome_message_created",
])

const contactPresenceEvents = new Set([
  "contact_presence_event_received",
  "contact_presence_state_decided",
  "contact_presence_update_started",
  "contact_presence_update_success",
  "contact_presence_update_failed",
])

const chatRealtimeEvents = new Set([
  "chat_send_success",
  "chat_message_rendered",
])

const userChatLoadEvents = new Set([
  "user_chat_room_resolve_failed",
  "user_chat_initial_fetch_error",
])

const identityAllowedEvents = new Set([
  "identity_lookup_failed",
  "identity_upsert_failed",
  "visitor_update_failed",
  "session_update_failed",
  "user_create_success",
  "identity_upsert_success",
])

const identityEvents = new Set([
  "auth_callback_received",
  "bridge_authorize_url_created",
  "bridge_callback_complete_page_shown",
  "callback_return_to_app_screen_rendered",
  "bridge_completed",
  "browser_bridge_callback_detected",
  "browser_bridge_completed",
  "browser_return_to_pwa_message_shown",
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
  "identity_lookup_failed",
  "identity_email_lookup_result",
  "identity_email_lookup_start",
  "identity_upsert_failed",
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
  "pwa_bridge_location_replace_called",
  "pwa_bridge_poll_success",
  "pwa_bridge_redirect_route_resolved",
  "pwa_line_popup_blocked",
  "pwa_login_focus_check",
  "pwa_login_pageshow_check",
  "pwa_login_pending_set",
  "pwa_popup_connecting_page_failed",
  "pwa_popup_connecting_page_written",
  "pwa_line_popup_opened",
  "pwa_line_popup_redirected",
  "pwa_login_polling_authenticated",
  "pwa_login_polling_started",
  "pwa_login_polling_tick",
  "pwa_login_polling_timeout",
  "pwa_login_polling_user_found",
  "pwa_login_redirect_pending",
  "pwa_login_location_replace_called",
  "pwa_login_redirect_fallback_reload",
  "pwa_login_reload_triggered",
  "pwa_login_route_resolved",
  "pwa_login_redirect_complete",
  "pwa_login_redirect_start",
  "pwa_login_success_modal_shown",
  "pwa_login_success_ui_shown",
  "pwa_popup_close_attempted",
  "pwa_popup_close_failed",
  "pwa_session_restored",
  "pwa_session_restore_failed",
  "pwa_session_refresh_failed",
  "pwa_session_refresh_success",
  "pwa_waiting_ui_shown",
  "session_update_failed",
  "session_updated",
  "session_after_identity_link",
  "user_create_success",
  "user_profile_sync_failed",
  "visitor_update_failed",
])

const authSessionEvents = new Set([
  "auth_entry_detected",
  "identity_conflict",
  "liff_init_started",
  "liff_login_required",
  "liff_profile_resolved",
  "liff_session_start",
  "liff_session_success",
  "login_cleared_logout_block",
  "logout_auto_restore_block_enabled",
  "logout_clicked",
  "logout_request_failed",
  "logout_request_started",
  "logout_request_success",
  "logout_redirect_started",
  "logout_session_user_cleared",
  "logout_toast_loading_shown",
  "logout_toast_success_shown",
  "logout_visibility_resolved",
  "participant_transfer_failed",
  "session_restore_blocked_by_logout",
  "session_user_resolve_failed",
  "session_user_resolve_from_consumed_otp",
  "session_user_resolve_from_cookie",
  "session_user_resolve_from_identity",
  "session_user_resolve_started",
  "session_user_restore_skipped_after_logout",
  "session_user_uuid_persisted",
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

const notifyEvents = new Set([
  "notification_trigger_created",
  "notification_receiver_resolve_started",
  "notification_receiver_resolve_success",
  "notification_receiver_resolve_failed",
  "notification_receiver_resolved",
  "notification_rule_started",
  "notification_availability_checked",
  "notification_presence_checked",
  "notification_contact_checked",
  "notification_contact_owner_mismatch",
  "notification_route_decided",
  "notification_line_target_resolved",
  "notification_push_target_resolved",
  "notification_push_dispatch_enter",
  "notification_push_dispatch_exit",
  "notification_delivery_started",
  "notification_delivery_success",
  "notification_delivery_failed",
  "notify_flow_started",
  "notify_flow_skipped",
  "notify_contact_candidates",
  "notify_contacts_resolved",
  "notify_contact_selected",
  "notify_delivery_skipped",
  "notify_push_send_started",
  "notify_push_send_success",
  "notify_push_send_failed",
  "notify_push_overridden",
  "notify_push_dispatch_failed",
  "notify_line_send_started",
  "notify_line_send_success",
  "notify_line_send_failed",
  "notify_line_fallback_used",
  "notify_in_app_toast_started",
  "notify_in_app_toast_sent",
  "push_public_key_resolved",
  "push_subscription_save_started",
  "push_subscription_save_success",
  "push_subscription_save_failed",
  "notification_setting_save_start",
  "notification_setting_contacts_updated",
  "notification_setting_contacts_reload",
  "notification_setting_save_success",
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

  if (contactPresenceEvents.has(event)) {
    return DEBUG_CONTACT_PRESENCE
  }

  if (chatRealtimeEvents.has(event)) {
    return CHAT_REALTIME_DEBUG
  }

  if (notifyEvents.has(event)) {
    return DEBUG_NOTIFY
  }

  if (userChatLoadEvents.has(event)) {
    return CHAT_REALTIME_DEBUG
  }

  if (identityEvents.has(event)) {
    if (identityAllowedEvents.has(event)) {
      return true
    }

    if (isUnexpectedEvent(event)) {
      return true
    }

    return false
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

  if (chatRealtimeEvents.has(event)) {
    return "CHAT_REALTIME"
  }

  if (notifyEvents.has(event)) {
    return "NOTIFY"
  }

  if (userChatLoadEvents.has(event)) {
    return "USER_CHAT"
  }

  if (chatFlowInfoEvents.has(event)) {
    return "CHAT_FLOW"
  }

  if (contactPresenceEvents.has(event)) {
    return "CONTACT_PRESENCE"
  }

  if (identityEvents.has(event)) {
    return "IDENTITY"
  }

  return "AUTH_SESSION"
}
