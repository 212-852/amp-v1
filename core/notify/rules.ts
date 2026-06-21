export type NotifyEventName =
  | "admin_page_accessed"
  | "admin_page_unauthorized_access"
  | "concierge_admin_entered"
  | "concierge_admin_left"
  | "concierge_admin_message"
  | "concierge_closed"
  | "concierge_requested"
  | "driver_page_unauthorized_access"
  | "odin_smoke_test"

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
    input.event === "concierge_admin_message" ||
    input.event === "odin_smoke_test"
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

export type ChatNotificationContactType = "line" | "push"

export type ChatNotifyContactRoute = {
  receiver_user_uuid: string
  contact_type: ChatNotificationContactType | null
  contact_value: string | null
  receiver_active: boolean
  push_preferred: boolean
  skipped_reason?: string | null
}

type ParticipantRow = {
  user_uuid?: string | null
  role?: string | null
}

type AvailabilityRow = {
  user_uuid?: string | null
}

type UserRow = {
  user_uuid?: string | null
  role?: string | null
}

type ContactRow = {
  type?: string | null
  value?: string | null
  endpoint?: string | null
  channel?: string | null
  state?: string | null
  receive?: boolean | null
  last_seen_at?: string | null
  updated_at?: string | null
}

function isActiveAppContact(contact: ContactRow, now = new Date()) {
  if (contact.receive !== true || contact.state !== "active") {
    return false
  }

  if (!contact.last_seen_at) {
    return true
  }

  const last_seen_time = Date.parse(contact.last_seen_at)

  return (
    Number.isFinite(last_seen_time) &&
    now.getTime() - last_seen_time <= 60 * 1000
  )
}

function resolveContactValue(contact: ContactRow) {
  if (contact.type === "push") {
    const raw_value = contact.endpoint?.trim() || contact.value?.trim() || ""

    if (!raw_value) {
      return null
    }

    try {
      const parsed = JSON.parse(raw_value) as { endpoint?: unknown }

      if (typeof parsed.endpoint === "string" && parsed.endpoint.trim()) {
        return parsed.endpoint.trim()
      }
    } catch {
      // contacts.value can be endpoint text or subscription JSON.
    }

    return raw_value
  }

  return contact.value?.trim() || null
}

function isPushSendState(contact: ContactRow) {
  return (
    contact.state === "background" ||
    contact.state === "hidden" ||
    contact.state === "offline"
  )
}

function selectNotifyContact(contacts: ContactRow[]): {
  contact_type: ChatNotificationContactType | null
  contact_value: string | null
  skipped_reason?: string | null
  push_preferred: boolean
} {
  const receivable = contacts.filter(
    (contact) =>
      contact.receive === true &&
      (contact.type === "line" || contact.type === "push"),
  )
  const push_contacts = receivable.filter((contact) => contact.type === "push")

  if (push_contacts.length > 0) {
    const push_contact = push_contacts.find(
      (contact) => isPushSendState(contact) && Boolean(resolveContactValue(contact)),
    )

    if (!push_contact) {
      return {
        contact_type: null,
        contact_value: null,
        skipped_reason: "push_not_sendable_no_line_fallback",
        push_preferred: true,
      }
    }

    return {
      contact_type: "push",
      contact_value: resolveContactValue(push_contact),
      skipped_reason: null,
      push_preferred: true,
    }
  }

  const line_contact = receivable.find(
    (contact) => contact.type === "line" && Boolean(resolveContactValue(contact)),
  )

  if (!line_contact) {
    return {
      contact_type: null,
      contact_value: null,
      skipped_reason: "missing_contact",
      push_preferred: false,
    }
  }

  return {
    contact_type: "line",
    contact_value: resolveContactValue(line_contact),
    skipped_reason: null,
    push_preferred: false,
  }
}

async function loadAdminConciergeUserUuids(user_uuids: string[]) {
  const unique_user_uuids = [...new Set(user_uuids)].filter(Boolean)

  if (unique_user_uuids.length === 0) {
    return new Set<string>()
  }

  const { getRestConfig, restHeaders, restUrl } = await import("@/core/db/rest")
  const config = getRestConfig()

  if (!config) {
    return new Set<string>()
  }

  const response = await fetch(
    restUrl(
      config,
      "users",
      [
        `user_uuid=in.(${unique_user_uuids.map(encodeURIComponent).join(",")})`,
        "role=in.(admin,concierge)",
        "select=user_uuid,role",
      ].join("&"),
    ),
    {
      headers: restHeaders(config),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    return new Set<string>()
  }

  const users = (await response.json()) as UserRow[]

  return new Set(
    users
      .filter((user) => user.role === "admin" || user.role === "concierge")
      .map((user) => user.user_uuid)
      .filter((user_uuid): user_uuid is string => Boolean(user_uuid)),
  )
}

async function loadRoomReceiverUserUuids(input: {
  room_uuid: string
  sender_uuid: string | null
  sender_role: string
}) {
  const { getRestConfig, restHeaders, restUrl } = await import("@/core/db/rest")
  const config = getRestConfig()

  if (!config) {
    return []
  }

  const response = await fetch(
    restUrl(
      config,
      "participants",
      [
        `room_uuid=eq.${encodeURIComponent(input.room_uuid)}`,
        "user_uuid=not.is.null",
        "role=not.eq.bot",
        "select=user_uuid,role",
      ].join("&"),
    ),
    {
      headers: restHeaders(config),
      cache: "no-store",
    },
  )

  const participants = response.ok
    ? ((await response.json()) as ParticipantRow[])
    : []
  const room_user_uuids = participants
    .filter(
      (participant) =>
        participant.role === "admin" || participant.role === "concierge",
    )
    .map((participant) => participant.user_uuid)
    .filter((user_uuid): user_uuid is string => Boolean(user_uuid))

  if (input.sender_role === "user" || input.sender_role === "guest") {
    const availability_response = await fetch(
      restUrl(
        config,
        "availability",
        "enabled=eq.true&select=user_uuid",
      ),
      {
        headers: restHeaders(config),
        cache: "no-store",
      },
    )
    const availability_users = availability_response.ok
      ? ((await availability_response.json()) as AvailabilityRow[])
      : []

    for (const row of availability_users) {
      if (row.user_uuid) {
        room_user_uuids.push(row.user_uuid)
      }
    }
  }

  const admin_concierge_user_uuids = await loadAdminConciergeUserUuids(
    room_user_uuids,
  )

  return [...new Set(room_user_uuids)].filter(
    (user_uuid) => user_uuid !== input.sender_uuid,
  ).filter(
    (user_uuid) => admin_concierge_user_uuids.has(user_uuid),
  )
}

async function loadReceiverContacts(user_uuid: string) {
  const { getRestConfig, restHeaders, restUrl } = await import("@/core/db/rest")
  const config = getRestConfig()

  if (!config) {
    return []
  }

  const response = await fetch(
    restUrl(
      config,
      "contacts",
      [
        `user_uuid=eq.${encodeURIComponent(user_uuid)}`,
        "type=in.(line,push)",
        "select=type,value,endpoint,channel,state,receive,last_seen_at,updated_at",
        "order=updated_at.desc",
      ].join("&"),
    ),
    {
      headers: restHeaders(config),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    return []
  }

  return (await response.json()) as ContactRow[]
}

export async function resolveChatNotifyRoutes(input: {
  room_uuid: string
  sender_uuid?: string | null
  sender_role: string
}): Promise<ChatNotifyContactRoute[]> {
  const receiver_user_uuids = await loadRoomReceiverUserUuids({
    room_uuid: input.room_uuid,
    sender_uuid: input.sender_uuid ?? null,
    sender_role: input.sender_role,
  })
  const routes: ChatNotifyContactRoute[] = []

  for (const receiver_user_uuid of receiver_user_uuids) {
    const contacts = await loadReceiverContacts(receiver_user_uuid)
    const receiver_active = contacts.some((contact) => isActiveAppContact(contact))
    const selected = receiver_active
      ? {
          contact_type: null,
          contact_value: null,
          skipped_reason: "receiver_active",
          push_preferred: false,
        }
      : selectNotifyContact(contacts)

    routes.push({
      receiver_user_uuid,
      contact_type: selected.contact_type,
      contact_value: selected.contact_value,
      receiver_active,
      push_preferred: selected.push_preferred,
      skipped_reason: selected.skipped_reason ?? null,
    })
  }

  return routes
}
