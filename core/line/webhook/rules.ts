export function normalize_allowed_line_users(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((line_user_id) => line_user_id.trim())
    .filter(Boolean)
}

function is_env_true(value: string | undefined) {
  return value?.trim().toLowerCase() === "true"
}

export function is_allowed_line_webhook_user(
  provider_user_id: string | null,
  env: NodeJS.ProcessEnv,
): boolean {
  if (!provider_user_id?.trim()) {
    return false
  }

  if (!is_env_true(env.LINE_WEBHOOK_REPLY_ENABLED)) {
    return false
  }

  return normalize_allowed_line_users(env.LINE_WEBHOOK_ALLOWED_USERS).includes(
    provider_user_id.trim(),
  )
}
