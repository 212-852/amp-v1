export type NotifyEventName =
  | "admin_page_accessed"
  | "admin_page_unauthorized_access"
  | "concierge_admin_entered"
  | "concierge_admin_left"
  | "concierge_admin_message"
  | "concierge_closed"
  | "concierge_requested"
  | "driver_page_unauthorized_access"

export type NotifyPriority = "normal" | "high" | "warning"

export type NotifyChannel = "discord" | "odin"

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
  alert_headline?: string | null
  alert_description?: string | null
  embed_title?: string | null
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

  if (
    input.event === "concierge_requested" ||
    input.event === "concierge_closed" ||
    input.event === "concierge_admin_entered" ||
    input.event === "concierge_admin_left" ||
    input.event === "concierge_admin_message"
  ) {
    return {
      channel: "odin",
      webhook_url: null,
      title: "Odin Concierge",
      event: input.event,
      priority: "normal",
      mention: null,
      summary: "concierge tracking",
      format: "plain",
      embed_color: null,
      request_id: input.request_id,
      payload: input.payload,
    }
  }

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
      alert_headline: "🚨🚨🚨 UNAUTHORIZED ADMIN ACCESS DETECTED 🚨🚨🚨",
      alert_description: "Non-admin user attempted to access admin page.",
      embed_title: "🚨 Unauthorized Admin Access",
      request_id: input.request_id,
      payload: input.payload,
    }
  }

  if (input.event === "driver_page_unauthorized_access") {
    return {
      channel: "discord",
      webhook_url,
      title: "Security Warning",
      event: input.event,
      priority: "warning",
      mention,
      summary: "unauthorized driver access detected",
      format: "security_alert",
      embed_color: 16753920,
      alert_headline: "⚠️⚠️⚠️ UNAUTHORIZED DRIVER ACCESS DETECTED ⚠️⚠️⚠️",
      alert_description: "Non-driver user attempted to access driver page.",
      embed_title: "⚠️ Unauthorized Driver Access",
      request_id: input.request_id,
      payload: input.payload,
    }
  }

  throw new Error(`Unsupported notify event: ${String(input.event)}`)
}
