const used_reply_tokens = new Set<string>()

export function beginLineReplyTokenScope() {
  used_reply_tokens.clear()
}

export function consumeLineReplyToken(
  reply_token: string | null | undefined,
): string | null {
  if (!reply_token || used_reply_tokens.has(reply_token)) {
    return null
  }

  used_reply_tokens.add(reply_token)
  return reply_token
}
