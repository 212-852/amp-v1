export const LINE_REPLY_TOKEN_SOURCE = "line_webhook" as const

export const LINE_REPLY_TOKEN_TTL_MS = 30_000

export type LineReplyTokenSource = typeof LINE_REPLY_TOKEN_SOURCE

export type LineReplyTokenRecord = {
  reply_token: string
  reply_token_received_at: number
  reply_token_used_at: number | null
  reply_token_source: LineReplyTokenSource
}

const reply_token_registry = new Map<string, LineReplyTokenRecord>()

export function beginLineReplyTokenScope() {
  reply_token_registry.clear()
}

export function register_line_webhook_reply_token(
  reply_token: string | null | undefined,
) {
  if (!reply_token?.trim()) {
    return null
  }

  const normalized = reply_token.trim()
  const record: LineReplyTokenRecord = {
    reply_token: normalized,
    reply_token_received_at: Date.now(),
    reply_token_used_at: null,
    reply_token_source: LINE_REPLY_TOKEN_SOURCE,
  }

  reply_token_registry.set(normalized, record)
  return record
}

export function read_line_reply_token_record(
  reply_token: string | null | undefined,
) {
  if (!reply_token?.trim()) {
    return null
  }

  return reply_token_registry.get(reply_token.trim()) ?? null
}

export type LineReplyTokenValidation =
  | {
      ok: true
      record: LineReplyTokenRecord
      reason: "valid"
    }
  | {
      ok: false
      reason:
        | "missing"
        | "unknown"
        | "already_used"
        | "expired"
        | "invalid_source"
    }

export function validate_line_webhook_reply_token(
  reply_token: string | null | undefined,
  now: number = Date.now(),
): LineReplyTokenValidation {
  if (!reply_token?.trim()) {
    return { ok: false, reason: "missing" }
  }

  const record = read_line_reply_token_record(reply_token)

  if (!record) {
    return { ok: false, reason: "unknown" }
  }

  if (record.reply_token_source !== LINE_REPLY_TOKEN_SOURCE) {
    return { ok: false, reason: "invalid_source" }
  }

  if (record.reply_token_used_at !== null) {
    return { ok: false, reason: "already_used" }
  }

  if (now - record.reply_token_received_at > LINE_REPLY_TOKEN_TTL_MS) {
    return { ok: false, reason: "expired" }
  }

  return { ok: true, record, reason: "valid" }
}

export function mark_line_reply_token_used(
  reply_token: string | null | undefined,
  used_at: number = Date.now(),
) {
  if (!reply_token?.trim()) {
    return null
  }

  const record = reply_token_registry.get(reply_token.trim())

  if (!record) {
    return null
  }

  const next = {
    ...record,
    reply_token_used_at: used_at,
  }

  reply_token_registry.set(reply_token.trim(), next)
  return next
}

export function is_line_reply_token_fresh(
  record: LineReplyTokenRecord | null | undefined,
  now: number = Date.now(),
): boolean {
  if (!record) {
    return false
  }

  if (record.reply_token_used_at !== null) {
    return false
  }

  return now - record.reply_token_received_at <= LINE_REPLY_TOKEN_TTL_MS
}

export function claim_line_reply_token_for_send(
  reply_token: string | null | undefined,
  now: number = Date.now(),
): LineReplyTokenValidation {
  const validation = validate_line_webhook_reply_token(reply_token, now)

  if (!validation.ok) {
    return validation
  }

  mark_line_reply_token_used(reply_token, now)
  return validation
}

/** @deprecated Use register_line_webhook_reply_token + validate_line_webhook_reply_token */
export function consumeLineReplyToken(
  reply_token: string | null | undefined,
): string | null {
  const validation = validate_line_webhook_reply_token(reply_token)

  if (!validation.ok) {
    return null
  }

  mark_line_reply_token_used(reply_token)
  return validation.record.reply_token
}
