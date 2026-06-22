import type { NotifyDelivery, NotifyEventName } from "@/core/notify/rules"

const DISCORD_API_BASE = "https://discord.com/api/v10"

export type OdinDeliveryResult = {
  delivered: boolean
  reason?: string
  thread_id?: string | null
  thread_status?: "open" | "closed" | null
  http_status?: number | null
}

type OdinConfig = {
  bot_token: string
  channel_id: string
  guild_id: string
  webhook_url: string
}

function resolveOdinEnv() {
  const bot_token = process.env.ACTION_ODIN_BOT_TOKEN?.trim() ?? ""
  const channel_id = process.env.ACTION_ODIN_CHANNEL_ID?.trim() ?? ""
  const guild_id = process.env.ACTION_ODIN_GUILD_ID?.trim() ?? ""
  const webhook_url = process.env.ACTION_ODIN_WEBHOOK_URL?.trim() ?? ""
  const missing: string[] = []

  if (!bot_token) {
    missing.push("ACTION_ODIN_BOT_TOKEN")
  }

  if (!channel_id) {
    missing.push("ACTION_ODIN_CHANNEL_ID")
  }

  if (!guild_id) {
    missing.push("ACTION_ODIN_GUILD_ID")
  }

  if (!webhook_url) {
    missing.push("ACTION_ODIN_WEBHOOK_URL")
  }

  return {
    bot_token,
    channel_id,
    guild_id,
    webhook_url,
    missing,
  }
}

export function resolveOdinSkipReason(): string | null {
  const env = resolveOdinEnv()

  if (env.missing.length > 0) {
    return `${env.missing.join(", ")} missing`
  }

  return null
}

function resolveOdinConfig(): OdinConfig | null {
  const env = resolveOdinEnv()

  if (env.missing.length > 0) {
    return null
  }

  return {
    bot_token: env.bot_token,
    channel_id: env.channel_id,
    guild_id: env.guild_id,
    webhook_url: env.webhook_url,
  }
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

function readRoomUuid(payload: Record<string, unknown>) {
  return typeof payload.room_uuid === "string" && payload.room_uuid.trim()
    ? payload.room_uuid.trim()
    : null
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
  log_context?: {
    room_uuid?: string | null
    thread_status?: string | null
  },
) {
  const thread_id = extractThreadIdFromPath(path, config.channel_id)

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
    console.warn({
      event: "odin_notify_failed",
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
    return {
      data: null as T,
      http_status: response.status,
    }
  }

  return {
    data: (await response.json()) as T,
    http_status: response.status,
  }
}

async function createThread(
  config: OdinConfig,
  input: {
    name: string
    customer_name?: string | null
    room_uuid: string | null
    thread_status: "open" | "closed"
  },
) {
  const thread_name = input.name.trim() || "Concierge"
  const customer_name = input.customer_name?.trim() || thread_name
  const room_uuid = input.room_uuid ?? "unknown"
  const initial_message = `Concierge requested.\nroom: ${room_uuid}\ncustomer: ${customer_name}`
  const entered_payload = {
    event: "odin_thread_create_entered",
    room_uuid: input.room_uuid,
    thread_id: null,
    thread_status: input.thread_status,
    http_status: null,
    error_message: null,
  }
  await logOdinServerDebug("odin_thread_create_entered", entered_payload)

  try {
    const payload = {
      name: thread_name,
      auto_archive_duration: 1440,
      message: {
        content: initial_message,
      },
    }

    const payload_ready = {
      event: "odin_thread_create_payload_ready",
      room_uuid: input.room_uuid,
      thread_id: null,
      thread_status: input.thread_status,
      http_status: null,
      error_message: null,
      has_message: Boolean(payload.message.content.trim()),
    }
    await logOdinServerDebug("odin_thread_create_payload_ready", payload_ready)

    const thread = await discordRequest<{ id: string }>(
      config,
      `/channels/${encodeURIComponent(config.channel_id)}/threads`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      {
        room_uuid: input.room_uuid,
        thread_status: input.thread_status,
      },
    )

    const response_payload = {
      event: "odin_thread_create_response",
      room_uuid: input.room_uuid,
      thread_id: thread.data.id,
      thread_status: "open",
      http_status: thread.http_status,
      error_message: null,
    }
    await logOdinServerDebug("odin_thread_create_response", response_payload)

    return {
      thread_id: thread.data.id,
      http_status: thread.http_status,
    }
  } catch (error) {
    const failed_payload = {
      event: "odin_thread_create_failed",
      room_uuid: input.room_uuid,
      thread_id: null,
      thread_status: input.thread_status,
      http_status: null,
      error_message: error instanceof Error ? error.message : String(error),
    }
    console.warn(failed_payload)
    await logOdinServerDebug("odin_thread_create_failed", failed_payload)
    throw error
  }
}

async function updateThreadArchived(
  config: OdinConfig,
  thread_id: string,
  archived: boolean,
  log_context?: {
    room_uuid?: string | null
    thread_status?: string | null
  },
) {
  await discordRequest<unknown>(
    config,
    `/channels/${encodeURIComponent(thread_id)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ archived, locked: false }),
    },
    log_context,
  )
}

async function closeThread(
  config: OdinConfig,
  input: {
    room_uuid: string | null
    thread_id: string
  },
) {
  const entered_payload = {
    event: "odin_thread_close_entered",
    room_uuid: input.room_uuid,
    thread_id: input.thread_id,
    thread_status: "closed",
    http_status: null,
    error_message: null,
  }
  await logOdinServerDebug("odin_thread_close_entered", entered_payload)

  try {
    const response = await discordRequest<unknown>(
      config,
      `/channels/${encodeURIComponent(input.thread_id)}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          archived: true,
          locked: false,
        }),
      },
      {
        room_uuid: input.room_uuid,
        thread_status: "closed",
      },
    )

    const response_payload = {
      event: "odin_thread_close_response",
      room_uuid: input.room_uuid,
      thread_id: input.thread_id,
      thread_status: "closed",
      http_status: response.http_status,
      error_message: null,
    }
    await logOdinServerDebug("odin_thread_close_response", response_payload)

    return response
  } catch (error) {
    const failed_payload = {
      event: "odin_thread_close_failed",
      room_uuid: input.room_uuid,
      thread_id: input.thread_id,
      thread_status: "closed",
      http_status: null,
      error_message: error instanceof Error ? error.message : String(error),
    }
    console.warn(failed_payload)
    await logOdinServerDebug("odin_thread_close_failed", failed_payload)
    throw error
  }
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
  const room_uuid = readRoomUuid(payload)
  const existing_thread_id = readPayloadString(payload, "thread_id", "")
  const thread_status = readPayloadString(payload, "thread_status", "closed")

  if (existing_thread_id) {
    if (thread_status === "closed") {
      await updateThreadArchived(config, existing_thread_id, false)
    }

    return {
      thread_id: existing_thread_id,
      created: false,
    }
  }

  const thread = await createThread(config, {
    name: customer_name,
    customer_name,
    room_uuid,
    thread_status: "closed",
  })

  return {
    thread_id: thread.thread_id,
    created: true,
  }
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

  const thread = await resolveOpenThreadForRequest(config, payload)
  return thread.thread_id
}

export async function deliverOdinNotification(
  delivery: NotifyDelivery,
): Promise<OdinDeliveryResult> {
  const room_uuid = readRoomUuid(delivery.payload)

  const skip_reason = resolveOdinSkipReason()

  if (skip_reason) {
    console.warn({
      event: "odin_notify_failed",
      notify_event: delivery.event,
      room_uuid,
      thread_id: null,
      thread_status: null,
      http_status: null,
      reason: skip_reason,
      error_message: skip_reason,
    })
    return { delivered: false, reason: skip_reason }
  }

  const config = resolveOdinConfig()

  if (!config) {
    console.warn({
      event: "odin_notify_failed",
      notify_event: delivery.event,
      room_uuid,
      thread_id: null,
      thread_status: null,
      http_status: null,
      reason: "odin_config_missing",
      error_message: "odin_config_missing",
    })
    return { delivered: false, reason: "odin_config_missing" }
  }

  try {
    if (delivery.event === "odin_smoke_test") {
      const thread = await createThread(config, {
        name: `odin-smoke-${new Date().toISOString()}`,
        customer_name: "Odin smoke test",
        room_uuid,
        thread_status: "open",
      })

      return {
        delivered: true,
        thread_id: thread.thread_id,
        thread_status: "open",
        http_status: thread.http_status,
      }
    }

    if (delivery.event === "concierge_requested") {
      const thread = await resolveOpenThreadForRequest(config, delivery.payload)
      const thread_id = thread.thread_id

      if (!thread.created) {
        await sendThreadMessage(
          config,
          thread_id,
          buildConciergeRequestMessage(delivery.payload),
        )
      }

      return { delivered: true, thread_id, thread_status: "open" }
    }

    if (delivery.event === "concierge_closed") {
      const thread_id = readPayloadString(delivery.payload, "thread_id", "")

      if (!thread_id) {
        console.warn({
          event: "odin_notify_failed",
          notify_event: delivery.event,
          room_uuid,
          thread_id: null,
          thread_status: "closed",
          http_status: null,
          reason: "thread_id_missing",
          error_message: "thread_id_missing",
        })
        return { delivered: false, reason: "thread_id_missing" }
      }

      const close_response = await closeThread(config, {
        room_uuid,
        thread_id,
      })
      await sendThreadMessage(config, thread_id, "Customer returned to bot mode.")

      return {
        delivered: true,
        thread_id,
        thread_status: "closed",
        http_status: close_response.http_status,
      }
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

    console.warn({
      event: "odin_notify_failed",
      notify_event: delivery.event,
      room_uuid,
      thread_id: null,
      thread_status: null,
      http_status: null,
      reason: "unsupported_event",
      error_message: "unsupported_event",
    })
    return { delivered: false, reason: "unsupported_event" }
  } catch (error) {
    const error_message = error instanceof Error ? error.message : String(error)

    console.warn({
      event: "odin_notify_failed",
      notify_event: delivery.event,
      room_uuid,
      thread_id:
        typeof delivery.payload.thread_id === "string"
          ? delivery.payload.thread_id
          : null,
      thread_status:
        typeof delivery.payload.thread_status === "string"
          ? delivery.payload.thread_status
          : null,
      http_status: null,
      error_message,
    })

    await logOdinServerDebug("odin_notify_failed", {
      notify_event: delivery.event,
      room_uuid,
      error_message,
    })

    throw error
  }
}
