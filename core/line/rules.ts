import type { LineIncomingEvent } from "@/core/line/context"

function is_env_true(value: string | undefined) {
  return value?.trim().toLowerCase() === "true"
}

export function normalize_allowed_line_users(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((line_user_id) => line_user_id.trim())
    .filter(Boolean)
}

export function get_allowed_line_users() {
  return normalize_allowed_line_users(process.env.LINE_WEBHOOK_ALLOWED_USERS)
}

export function is_line_webhook_test_mode() {
  return is_env_true(process.env.LINE_WEBHOOK_TEST_MODE)
}

export function is_line_webhook_reply_enabled() {
  return is_env_true(process.env.LINE_WEBHOOK_REPLY_ENABLED)
}

export function is_allowed_line_user(provider_user_id: string | null): boolean {
  const normalized = provider_user_id?.trim()

  if (!normalized) {
    return false
  }

  if (!is_line_webhook_reply_enabled()) {
    return false
  }

  return get_allowed_line_users().includes(normalized)
}

export function can_reply_to_allowed_line_event(
  event: Pick<LineIncomingEvent, "reply_token">,
) {
  return is_line_webhook_reply_enabled() && Boolean(event.reply_token)
}
