import type { LineIncomingEvent } from "@/core/line/context"

export type LineWebhookGateReason =
  | "allowed"
  | "line_test_mode_not_allowed"
  | "missing_provider_user_id"

export type LineWebhookGateResult = {
  allowed: boolean
  reason: LineWebhookGateReason
  archive: boolean
  reply: boolean
  output: boolean
}

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

export function resolve_line_webhook_gate(
  event: Pick<LineIncomingEvent, "provider_user_id" | "reply_token">,
): LineWebhookGateResult {
  const provider_user_id = event.provider_user_id?.trim()

  if (!provider_user_id) {
    return {
      allowed: false,
      reason: "missing_provider_user_id",
      archive: false,
      reply: false,
      output: false,
    }
  }

  if (
    is_line_webhook_test_mode() &&
    !get_allowed_line_users().includes(provider_user_id)
  ) {
    return {
      allowed: false,
      reason: "line_test_mode_not_allowed",
      archive: false,
      reply: false,
      output: false,
    }
  }

  const reply_ready =
    is_line_webhook_reply_enabled() && Boolean(event.reply_token)

  return {
    allowed: true,
    reason: "allowed",
    archive: true,
    reply: reply_ready,
    output: reply_ready,
  }
}
