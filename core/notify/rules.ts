export type NotifyEventName =
  | "admin_page_accessed"
  | "admin_page_unauthorized_access"

export type NotifyPriority = "normal" | "high"

export type NotifyChannel = "discord"

export type NotifyEventInput = {
  event: NotifyEventName
  request_id?: string | null
  payload: Record<string, unknown>
}

export type NotifyFormat = "plain" | "security_alert"

export type NotifyDelivery = {
  channel: NotifyChannel
  webhook_url: string | null
  title: string
  event: NotifyEventName
  priority: NotifyPriority
  mention: string | null
  summary: string
  format: NotifyFormat
  embed_color?: number | null
  request_id?: string | null
  payload: Record<string, unknown>
}

function resolveWolfWebhook() {
  const webhook = process.env.NOTIFY_WOLF_WEBHOOK?.trim()
  return webhook || null
}

function resolveWolfMention() {
  const mention = process.env.NOTIFY_WOLF_MENTION?.trim()
  return mention || null
}

export function resolveNotifyDelivery(input: NotifyEventInput): NotifyDelivery {
  const webhook_url = resolveWolfWebhook()
  const mention = resolveWolfMention()

  if (input.event === "admin_page_accessed") {
    return {
      channel: "discord",
      webhook_url,
      title: "Admin Access",
      event: input.event,
      priority: "normal",
      mention,
      summary: "admin page accessed",
      format: "plain",
      embed_color: null,
      request_id: input.request_id,
      payload: input.payload,
    }
  }

  if (input.event === "admin_page_unauthorized_access") {
    return {
      channel: "discord",
      webhook_url,
      title: "Security Alert",
      event: input.event,
      priority: "high",
      mention,
      summary: "unauthorized admin access detected",
      format: "security_alert",
      embed_color: 15158332,
      request_id: input.request_id,
      payload: input.payload,
    }
  }

  throw new Error(`Unsupported notify event: ${String(input.event)}`)
}
