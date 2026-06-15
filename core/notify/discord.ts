const TEMP_AUTH_DEBUG_OWNER_ID = "1475072657505648701"

export type DiscordNotifyPayload = {
  title: string
  event: string
  request_id?: string | null
  payload: Record<string, unknown>
}

export async function notifyDiscord(payload: DiscordNotifyPayload) {
  if (!process.env.DEBUG_CAT_WEBHOOK) {
    return
  }

  await fetch(process.env.DEBUG_CAT_WEBHOOK, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username: payload.title,
      content:
        `<@${TEMP_AUTH_DEBUG_OWNER_ID}>\n` +
        `[DEBUG] ${payload.title}\n` +
        `event: ${payload.event}\n` +
        "```json\n" +
        JSON.stringify(
          {
            event: payload.event,
            request_id: payload.request_id ?? null,
            ...payload.payload,
          },
          null,
          2,
        ) +
        "\n```",
      allowed_mentions: {
        users: [TEMP_AUTH_DEBUG_OWNER_ID],
      },
    }),
  })
}
