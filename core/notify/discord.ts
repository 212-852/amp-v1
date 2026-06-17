import type { NotifyDelivery } from "@/core/notify/rules"

const TEMP_AUTH_DEBUG_OWNER_ID = "1475072657505648701"

export type DiscordNotifyPayload = {
  title: string
  event: string
  request_id?: string | null
  payload: Record<string, unknown>
}

function formatPayloadFields(payload: Record<string, unknown>) {
  return Object.entries(payload)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join("\n")
}

function buildJsonBlock(
  event: string,
  request_id: string | null | undefined,
  payload: Record<string, unknown>,
) {
  return (
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
    "\n```"
  )
}

export async function deliverDiscordNotification(delivery: NotifyDelivery) {
  if (!delivery.webhook_url) {
    return { delivered: false, reason: "webhook_missing" as const }
  }

  const mention_prefix = delivery.mention ? `${delivery.mention} ` : ""
  const fields = formatPayloadFields(delivery.payload)
  const priority_line =
    delivery.priority === "high" ? "priority: high\n" : ""

  await fetch(delivery.webhook_url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username: delivery.title,
      content:
        `${mention_prefix}${delivery.summary}\n` +
        `event: ${delivery.event}\n` +
        priority_line +
        (fields ? `${fields}\n` : "") +
        buildJsonBlock(delivery.event, delivery.request_id, delivery.payload),
      allowed_mentions: {
        parse: ["users", "roles"],
      },
    }),
  })

  return { delivered: true as const }
}

export async function notifyDiscord(payload: DiscordNotifyPayload) {
  if (!process.env.DEBUG_CAT_WEBHOOK) {
    return
  }

  const fields = formatPayloadFields(payload.payload)

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
        (fields ? `${fields}\n` : "") +
        buildJsonBlock(payload.event, payload.request_id, payload.payload),
      allowed_mentions: {
        users: [TEMP_AUTH_DEBUG_OWNER_ID],
      },
    }),
  })
}
