const TEMP_AUTH_DEBUG_OWNER_ID = "1475072657505648701"

export async function sendAuthDebug(
  event: string,
  payload: Record<string, unknown>,
  request_id?: string | null,
) {
  if (
    process.env.DEBUG_CAT_SWITCH !== "true" ||
    !process.env.DEBUG_CAT_WEBHOOK
  ) {
    return
  }

  try {
    await fetch(process.env.DEBUG_CAT_WEBHOOK, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: "AUTH SESSION",
        content:
          `<@${TEMP_AUTH_DEBUG_OWNER_ID}>\n` +
          "[DEBUG] AUTH_SESSION\n" +
          `event: ${event}\n` +
          "```json\n" +
          JSON.stringify(
            {
              event,
              request_id: request_id ?? null,
              ...payload,
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
  } catch (error) {
    console.error("TEMP_AUTH_DEBUG_FAILED", error)
  }
}
