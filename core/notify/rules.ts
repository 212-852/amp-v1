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

export type ChatNotifyPushSubscription = {
  endpoint: string
  keys?: {
    p256dh?: string | null
    auth?: string | null
  }
}

export type ChatNotifySelectedContact = {
  contact_uuid: string | null
  contact_type: ChatNotificationContactType
  contact_value: string
  receive: boolean | null
  state: string | null
  channel: string | null
  push_subscription?: ChatNotifyPushSubscription | null
}

export type ChatNotifyContactRoute = {
  receiver_user_uuid: string
  selected_contact: ChatNotifySelectedContact | null
  receiver_active: boolean
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
  contact_uuid?: string | null
  type?: string | null
  value?: string | null
  endpoint?: string | null
  p256dh?: string | null
  auth?: string | null
  channel?: string | null
  state?: string | null
  receive?: boolean | null
  last_seen_at?: string | null
  updated_at?: string | null
}

function isReceiverPresent(contact: ContactRow, now = new Date()) {
  if (contact.receive !== true || contact.state !== "active") {
    return false
  }

  if (!contact.last_seen_at) {
    return false
  }

  const last_seen_time = Date.parse(contact.last_seen_at)

  return (
    Number.isFinite(last_seen_time) &&
    now.getTime() - last_seen_time <= 60 * 1000
  )
}

function resolveContactValue(contact: ContactRow) {
  return contact.value?.trim() || contact.endpoint?.trim() || null
}

function resolvePushSubscription(contact: ContactRow): ChatNotifyPushSubscription | null {
  const raw_value = contact.value?.trim() || ""
  let endpoint = contact.endpoint?.trim() || ""
  let p256dh = contact.p256dh?.trim() || null
  let auth = contact.auth?.trim() || null

  if (raw_value.startsWith("{")) {
    try {
      const parsed = JSON.parse(raw_value) as {
        endpoint?: unknown
        keys?: {
          p256dh?: unknown
          auth?: unknown
        }
      }

      if (typeof parsed.endpoint === "string") {
        endpoint = parsed.endpoint.trim()
      }
      if (typeof parsed.keys?.p256dh === "string") {
        p256dh = parsed.keys.p256dh.trim() || p256dh
      }
      if (typeof parsed.keys?.auth === "string") {
        auth = parsed.keys.auth.trim() || auth
      }
    } catch {
      // contacts.value can be endpoint text or subscription JSON.
    }
  }

  endpoint = endpoint || raw_value

  if (!endpoint) {
    return null
  }

  return {
    endpoint,
    keys: {
      p256dh,
      auth,
    },
  }
}

function toSelectedContact(contact: ContactRow): ChatNotifySelectedContact | null {
  if (contact.type !== "line" && contact.type !== "push") {
    return null
  }

  if (contact.receive !== true) {
    return null
  }

  const contact_value =
    contact.type === "push"
      ? resolvePushSubscription(contact)?.endpoint ?? null
      : resolveContactValue(contact)

  if (!contact_value) {
    return null
  }

  return {
    contact_uuid: contact.contact_uuid ?? null,
    contact_type: contact.type,
    contact_value,
    receive: contact.receive ?? null,
    state: contact.state ?? null,
    channel: contact.channel ?? null,
    push_subscription:
      contact.type === "push" ? resolvePushSubscription(contact) : null,
  }
}

function selectNotifyContact(contacts: ContactRow[]): {
  selected_contact: ChatNotifySelectedContact | null
  skipped_reason?: string | null
} {
  const receivable = contacts
    .map(toSelectedContact)
    .filter((contact): contact is ChatNotifySelectedContact => Boolean(contact))
  const push_contact =
    receivable.find((contact) => contact.contact_type === "push") ?? null
  const line_contact =
    receivable.find((contact) => contact.contact_type === "line") ?? null

  if (push_contact) {
    return {
      selected_contact: push_contact,
      skipped_reason: null,
    }
  }

  if (line_contact) {
    return {
      selected_contact: line_contact,
      skipped_reason: null,
    }
  }

  return {
    selected_contact: null,
    skipped_reason: "no_contact",
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
        "role=in.(admin,concierge,owner)",
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
      .filter(
        (user) =>
          user.role === "admin" ||
          user.role === "concierge" ||
          user.role === "owner",
      )
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
        "receive=eq.true",
        "select=contact_uuid,type,value,endpoint,p256dh,auth,channel,state,receive,last_seen_at,updated_at",
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
  request_id?: string | null
}): Promise<ChatNotifyContactRoute[]> {
  const { sendNotifyDebug } = await import("@/core/notify/debug")

  const receiver_user_uuids = await loadRoomReceiverUserUuids({
    room_uuid: input.room_uuid,
    sender_uuid: input.sender_uuid ?? null,
    sender_role: input.sender_role,
  })
  const routes: ChatNotifyContactRoute[] = []

  for (const receiver_user_uuid of receiver_user_uuids) {
    const contacts = await loadReceiverContacts(receiver_user_uuid)
    const receiver_active = contacts.some((contact) => isReceiverPresent(contact))
    const selected = receiver_active
      ? {
          selected_contact: null,
          skipped_reason: "receiver_active",
        }
      : selectNotifyContact(contacts)

    await sendNotifyDebug("notify_contact_resolved", {
      room_uuid: input.room_uuid,
      sender_uuid: input.sender_uuid ?? null,
      receiver_uuid: receiver_user_uuid,
      contact_uuid: selected.selected_contact?.contact_uuid ?? null,
      contact_type: selected.selected_contact?.contact_type ?? null,
      receive: selected.selected_contact?.receive ?? null,
      state: selected.selected_contact?.state ?? null,
      channel: selected.selected_contact?.channel ?? null,
      receiver_active,
      skipped_reason: selected.skipped_reason ?? null,
      request_id: input.request_id ?? null,
    })

    routes.push({
      receiver_user_uuid,
      selected_contact: selected.selected_contact,
      receiver_active,
      skipped_reason: selected.skipped_reason ?? null,
    })
  }

  return routes
}
