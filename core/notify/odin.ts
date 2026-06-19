import type { NotifyDelivery, NotifyEventName } from "@/core/notify/rules"

const DISCORD_API_BASE = "https://discord.com/api/v10"
const PUBLIC_THREAD_TYPE = 11

export type OdinDeliveryResult = {
  delivered: boolean
  reason?: string
  thread_id?: string | null
  thread_status?: "open" | "closed" | null
}

type OdinConfig = {
  bot_token: string
  channel_id: string
}

function resolveOdinConfig(): OdinConfig | null {
  const bot_token = process.env.ACTION_ODIN_BOT_TOKEN?.trim()
  const channel_id = process.env.ACTION_ODIN_CHANNEL_ID?.trim()

  if (!bot_token || !channel_id) {
    return null
  }

  return { bot_token, channel_id }
}

function readPayloadString(
  payload: Record<string, unknown>,
  key: string,
  fallback = "unknown",
) {
  const value = payload[key]

  if (typeof value !== "string" || !value.trim()) {
    return fallback
  }

  return value.trim()
}

async function discordRequest<T>(
  config: OdinConfig,
  path: string,
  init: RequestInit,
) {
  const response = await fetch(`${DISCORD_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bot ${config.bot_token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  })

  if (!response.ok) {
    const body = await response.text().catch(() => "")
    throw new Error(
      `Odin Discord request failed: ${response.status} ${body || response.statusText}`,
    )
  }

  if (response.status === 204) {
    return null as T
  }

  return (await response.json()) as T
}

async function createThread(config: OdinConfig, name: string) {
  const thread = await discordRequest<{ id: string }>(
    config,
    `/channels/${encodeURIComponent(config.channel_id)}/threads`,
    {
      method: "POST",
      body: JSON.stringify({
        name,
        type: PUBLIC_THREAD_TYPE,
        auto_archive_duration: 1440,
      }),
    },
  )

  return thread.id
}

async function updateThreadArchived(
  config: OdinConfig,
  thread_id: string,
  archived: boolean,
) {
  await discordRequest<unknown>(
    config,
    `/channels/${encodeURIComponent(thread_id)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ archived }),
    },
  )
}

async function sendThreadMessage(
  config: OdinConfig,
  thread_id: string,
  content: string,
) {
  await discordRequest<unknown>(
    config,
    `/channels/${encodeURIComponent(thread_id)}/messages`,
    {
      method: "POST",
      body: JSON.stringify({
        content,
        allowed_mentions: { parse: [] },
      }),
    },
  )
}

function buildConciergeRequestMessage(payload: Record<string, unknown>) {
  const customer_name = readPayloadString(payload, "customer_name", "Customer")
  const room_uuid = readPayloadString(payload, "room_uuid")

  return [
    "[CONCIERGE REQUEST]",
    "",
    "customer:",
    customer_name,
    "room:",
    room_uuid,
    "",
    "Customer requested concierge support.",
  ].join("\n")
}

function buildConciergeClosedMessage(payload: Record<string, unknown>) {
  const customer_name = readPayloadString(payload, "customer_name", "Customer")
  const room_uuid = readPayloadString(payload, "room_uuid")

  return [
    "[CONCIERGE CLOSED]",
    "",
    "customer:",
    customer_name,
    "room:",
    room_uuid,
    "",
    "Customer returned to bot mode.",
  ].join("\n")
}

function buildAdminPresenceMessage(
  event: NotifyEventName,
  payload: Record<string, unknown>,
) {
  const admin_name = readPayloadString(payload, "admin_name", "Admin")
  const action =
    event === "concierge_admin_entered" ? "started support." : "left support."

  return ["[CONCIERGE]", "", `${admin_name} ${action}`].join("\n")
}

async function resolveOpenThreadForRequest(
  config: OdinConfig,
  payload: Record<string, unknown>,
) {
  const customer_name = readPayloadString(payload, "customer_name", "Customer")
  const existing_thread_id = readPayloadString(payload, "thread_id", "")
  const thread_status = readPayloadString(payload, "thread_status", "closed")

  if (existing_thread_id) {
    if (thread_status === "closed") {
      await updateThreadArchived(config, existing_thread_id, false)
    }

    return existing_thread_id
  }

  return createThread(config, customer_name)
}

export async function deliverOdinNotification(
  delivery: NotifyDelivery,
): Promise<OdinDeliveryResult> {
  const config = resolveOdinConfig()

  if (!config) {
    return { delivered: false, reason: "odin_config_missing" }
  }

  if (delivery.event === "concierge_requested") {
    const thread_id = await resolveOpenThreadForRequest(config, delivery.payload)

    await sendThreadMessage(
      config,
      thread_id,
      buildConciergeRequestMessage(delivery.payload),
    )

    return { delivered: true, thread_id, thread_status: "open" }
  }

  if (delivery.event === "concierge_closed") {
    const thread_id = readPayloadString(delivery.payload, "thread_id", "")

    if (!thread_id) {
      return { delivered: false, reason: "thread_id_missing" }
    }

    await sendThreadMessage(
      config,
      thread_id,
      buildConciergeClosedMessage(delivery.payload),
    )
    await updateThreadArchived(config, thread_id, true)

    return { delivered: true, thread_id, thread_status: "closed" }
  }

  if (
    delivery.event === "concierge_admin_entered" ||
    delivery.event === "concierge_admin_left"
  ) {
    const thread_id = readPayloadString(delivery.payload, "thread_id", "")

    if (!thread_id) {
      return { delivered: false, reason: "thread_id_missing" }
    }

    await sendThreadMessage(
      config,
      thread_id,
      buildAdminPresenceMessage(delivery.event, delivery.payload),
    )

    return { delivered: true, thread_id }
  }

  return { delivered: false, reason: "unsupported_event" }
}
