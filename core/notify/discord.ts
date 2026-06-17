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

function readPayloadValue(
  payload: Record<string, unknown>,
  key: string,
) {
  const value = payload[key]

  if (value === undefined || value === null || value === "") {
    return "unknown"
  }

  return String(value)
}

function buildSecurityAlertMessage(delivery: NotifyDelivery) {
  const payload = delivery.payload
  const mention_line = delivery.mention ?? ""
  const request_id =
    readPayloadValue(payload, "request_id") !== "unknown"
      ? readPayloadValue(payload, "request_id")
      : delivery.request_id ?? "unknown"

  const content = [
    "🚨🚨🚨 UNAUTHORIZED ADMIN ACCESS DETECTED 🚨🚨🚨",
    "",
    mention_line,
    "",
    "⚠️ Non-admin user attempted to access admin page.",
    "",
    `📍 Path: ${readPayloadValue(payload, "pathname")}`,
    `👤 Role: ${readPayloadValue(payload, "resolved_role")}`,
    `⭐ Tier: ${readPayloadValue(payload, "tier")}`,
    "",
    "🆔 User UUID",
    readPayloadValue(payload, "user_uuid"),
    "",
    "🆔 Visitor UUID",
    readPayloadValue(payload, "visitor_uuid"),
    "",
    "🌐 IP",
    readPayloadValue(payload, "ip"),
    "",
    "📱 Device",
    readPayloadValue(payload, "user_agent"),
    "",
    "🔑 Request ID",
    request_id,
    "",
    "⛔ Access denied.",
  ]
    .filter((line, index, lines) => !(line === "" && lines[index - 1] === ""))
    .join("\n")

  const embed = {
    title: "🚨 Unauthorized Admin Access",
    description: "Non-admin user attempted to access admin page.",
    color: delivery.embed_color ?? 15158332,
    timestamp: new Date().toISOString(),
    fields: [
      {
        name: "Path",
        value: readPayloadValue(payload, "pathname"),
        inline: true,
      },
      {
        name: "Role",
        value: readPayloadValue(payload, "resolved_role"),
        inline: true,
      },
      {
        name: "Tier",
        value: readPayloadValue(payload, "tier"),
        inline: true,
      },
      {
        name: "User UUID",
        value: readPayloadValue(payload, "user_uuid"),
        inline: false,
      },
      {
        name: "Visitor UUID",
        value: readPayloadValue(payload, "visitor_uuid"),
        inline: false,
      },
      {
        name: "IP",
        value: readPayloadValue(payload, "ip"),
        inline: true,
      },
      {
        name: "Request ID",
        value: request_id,
        inline: true,
      },
      {
        name: "Device",
        value: readPayloadValue(payload, "user_agent").slice(0, 1024),
        inline: false,
      },
    ],
  }

  return {
    username: delivery.title,
    content,
    embeds: [embed],
    allowed_mentions: {
      parse: ["users", "roles"],
    },
  }
}

function buildPlainMessage(delivery: NotifyDelivery) {
  const mention_prefix = delivery.mention ? `${delivery.mention} ` : ""
  const fields = formatPayloadFields(delivery.payload)
  const priority_line =
    delivery.priority === "high" ? "priority: high\n" : ""

  return {
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
  }
}

export async function deliverDiscordNotification(delivery: NotifyDelivery) {
  if (!delivery.webhook_url) {
    return { delivered: false, reason: "webhook_missing" as const }
  }

  const body =
    delivery.format === "security_alert"
      ? buildSecurityAlertMessage(delivery)
      : buildPlainMessage(delivery)

  await fetch(delivery.webhook_url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
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
