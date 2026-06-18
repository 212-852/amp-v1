export function get_allowed_line_users() {
  return (process.env.LINE_WEBHOOK_ALLOWED_USERS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
}

function is_env_true(value: string | undefined) {
  return value?.trim().toLowerCase() === "true"
}

export function get_line_webhook_test_mode() {
  return is_env_true(process.env.LINE_WEBHOOK_TEST_MODE)
}

export function is_line_webhook_reply_enabled() {
  return is_env_true(process.env.LINE_WEBHOOK_REPLY_ENABLED)
}

export function can_process_line_webhook_user(input: {
  provider_user_id: string
  source_channel: string
  entry: "webhook" | "other"
}) {
  if (input.source_channel !== "line" || input.entry !== "webhook") {
    return true
  }

  if (!get_line_webhook_test_mode()) {
    return true
  }

  return (
    is_line_webhook_reply_enabled() &&
    get_allowed_line_users().includes(input.provider_user_id.trim())
  )
}

export function can_reply_to_line_user(provider_user_id: string) {
  return (
    is_line_webhook_reply_enabled() &&
    get_allowed_line_users().includes(provider_user_id.trim())
  )
}

export function resolve_line_reply_reason(provider_user_id: string) {
  if (!is_line_webhook_reply_enabled()) {
    return "reply_disabled"
  }

  if (!get_allowed_line_users().includes(provider_user_id.trim())) {
    return "provider_user_not_allowed"
  }

  return "allowed"
}
