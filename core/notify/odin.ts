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

export function resolveOdinSkipReason(): string | null {
  const bot_token = process.env.ACTION_ODIN_BOT_TOKEN?.trim()
  const channel_id = process.env.ACTION_ODIN_CHANNEL_ID?.trim()

  if (!bot_token) {
    return "ACTION_ODIN_BOT_TOKEN missing"
  }

  if (!channel_id) {
    return "ACTION_ODIN_CHANNEL_ID missing"
  }

  return null
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

async function logOdinServerDebug(
  event: string,
  payload: Record<string, unknown>,
) {
  try {
    const { sendAuthDebug } = await import("@/core/debug")
    await sendAuthDebug(event, payload, null)
  } catch {
    // Server debug only.
  }
}

function extractThreadIdFromPath(path: string, channel_id: string) {
  const segments = path.split("/").filter(Boolean)

  if (segments[0] !== "channels") {
    return null
  }

  const target_id = segments[1] ? decodeURIComponent(segments[1]) : null

  if (!target_id || target_id === channel_id) {
    return null
  }

  return target_id
}

async function discordRequest<T>(
  config: OdinConfig,
  path: string,
  init: RequestInit,
) {
  const thread_id = extractThreadIdFromPath(path, config.channel_id)

  console.log({
    event: "odin_request",
    channel_id: config.channel_id,
    thread_id,
  })

  const response = await fetch(`${DISCORD_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bot ${config.bot_token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  })

  console.log({
    event: "odin_response",
    status: response.status,
    ok: response.ok,
  })

  if (!response.ok) {
    const body = await response.text().catch(() => "")
    await logOdinServerDebug("notify_delivery_failed", {
      channel: "odin",
      status: response.status,
      response_body: body,
      path,
    })
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

function buildAdminMessage(payload: Record<string, unknown>) {
  const admin_name = readPayloadString(payload, "admin_name", "Admin")
  const message_body = readPayloadString(payload, "message_body", "")
  const room_uuid = readPayloadString(payload, "room_uuid")

  return [
    "[CONCIERGE MESSAGE]",
    "",
    "admin:",
    admin_name,
    "room:",
    room_uuid,
    "",
    message_body,
  ].join("\n")
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

async function resolveThreadForDelivery(
  config: OdinConfig,
  payload: Record<string, unknown>,
) {
  const existing_thread_id = readPayloadString(payload, "thread_id", "")

  if (existing_thread_id) {
    const thread_status = readPayloadString(payload, "thread_status", "open")

    if (thread_status === "closed") {
      await updateThreadArchived(config, existing_thread_id, false)
    }

    return existing_thread_id
  }

  return resolveOpenThreadForRequest(config, payload)
}

export async function deliverOdinNotification(
  delivery: NotifyDelivery,
): Promise<OdinDeliveryResult> {
  const skip_reason = resolveOdinSkipReason()

  if (skip_reason) {
    return { delivered: false, reason: skip_reason }
  }

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
    delivery.event === "concierge_admin_left" ||
    delivery.event === "concierge_admin_message"
  ) {
    const thread_id = await resolveThreadForDelivery(config, delivery.payload)
    const content =
      delivery.event === "concierge_admin_message"
        ? buildAdminMessage(delivery.payload)
        : buildAdminPresenceMessage(delivery.event, delivery.payload)

    await sendThreadMessage(config, thread_id, content)

    return {
      delivered: true,
      thread_id,
      thread_status: "open",
    }
  }

  return { delivered: false, reason: "unsupported_event" }
}
