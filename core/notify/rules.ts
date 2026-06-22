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
  receiver_role: string | null
  in_room: boolean
  contact_state: string | null
  delivery: import("@/core/notify/chat_rules").ChatNotifyDeliveryKind
  selected_contact: ChatNotifySelectedContact | null
  line_user_id: string | null
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

function isContactInApp(state: string | null | undefined) {
  return state === "active"
}

function isContactAway(state: string | null | undefined) {
  return (
    state === "hidden" || state === "background" || state === "offline"
  )
}

function isAdminReceiverRole(role: string | null | undefined) {
  return role === "admin" || role === "owner"
}

function isValidPushContact(contact: ContactRow) {
  return (
    contact.type === "push" &&
    contact.receive === true &&
    Boolean(resolvePushSubscription(contact))
  )
}

function toSelectedPushContact(
  contact: ContactRow,
): ChatNotifySelectedContact | null {
  const push_subscription = resolvePushSubscription(contact)

  if (!push_subscription) {
    return null
  }

  return {
    contact_uuid: contact.contact_uuid ?? null,
    contact_type: "push",
    contact_value: push_subscription.endpoint,
    receive: contact.receive ?? null,
    state: contact.state ?? null,
    channel: contact.channel ?? null,
    push_subscription,
  }
}

function resolveReceiverNotifyDelivery(input: {
  in_room: boolean
  contact: ContactRow | null
  receiver_role: string | null
  line_provider_user_id: string | null
}): {
  delivery: import("@/core/notify/chat_rules").ChatNotifyDeliveryKind
  selected_contact: ChatNotifySelectedContact | null
  line_user_id: string | null
  skipped_reason: string | null
} {
  if (input.in_room) {
    return {
      delivery: "none",
      selected_contact: null,
      line_user_id: null,
      skipped_reason: "receiver_in_room",
    }
  }

  const contact = input.contact
  const state = contact?.state ?? null

  if (isContactInApp(state)) {
    return {
      delivery: "in_app_toast",
      selected_contact: null,
      line_user_id: null,
      skipped_reason: null,
    }
  }

  if (!isContactAway(state)) {
    return {
      delivery: "none",
      selected_contact: null,
      line_user_id: null,
      skipped_reason: "contact_state_unknown",
    }
  }

  if (isAdminReceiverRole(input.receiver_role)) {
    if (!input.line_provider_user_id) {
      return {
        delivery: "none",
        selected_contact: null,
        line_user_id: null,
        skipped_reason: "missing_line_identity",
      }
    }

    return {
      delivery: "line",
      selected_contact: {
        contact_uuid: contact?.contact_uuid ?? null,
        contact_type: "line",
        contact_value: input.line_provider_user_id,
        receive: contact?.receive ?? null,
        state,
        channel: contact?.channel ?? null,
        push_subscription: null,
      },
      line_user_id: input.line_provider_user_id,
      skipped_reason: null,
    }
  }

  if (contact && isValidPushContact(contact)) {
    return {
      delivery: "push",
      selected_contact: toSelectedPushContact(contact),
      line_user_id: input.line_provider_user_id,
      skipped_reason: null,
    }
  }

  if (input.line_provider_user_id) {
    return {
      delivery: "line",
      selected_contact: {
        contact_uuid: contact?.contact_uuid ?? null,
        contact_type: "line",
        contact_value: input.line_provider_user_id,
        receive: contact?.receive ?? null,
        state,
        channel: contact?.channel ?? null,
        push_subscription: null,
      },
      line_user_id: input.line_provider_user_id,
      skipped_reason: null,
    }
  }

  return {
    delivery: "none",
    selected_contact: null,
    line_user_id: null,
    skipped_reason: "missing_contact",
  }
}

function resolvePushSubscription(contact: ContactRow): ChatNotifyPushSubscription | null {
  const raw_value = contact.value?.trim() || ""
  const endpoint = contact.endpoint?.trim() || ""
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

  if (!endpoint || !p256dh || !auth) {
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
        "select=contact_uuid,type,value,endpoint,p256dh,auth,channel,state,receive,last_seen_at,updated_at",
        "order=updated_at.desc",
        "limit=1",
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

async function loadReceiverUserRoles(user_uuids: string[]) {
  const unique_user_uuids = [...new Set(user_uuids)].filter(Boolean)
  const role_map = new Map<string, string>()

  if (unique_user_uuids.length === 0) {
    return role_map
  }

  const { getRestConfig, restHeaders, restUrl } = await import("@/core/db/rest")
  const config = getRestConfig()

  if (!config) {
    return role_map
  }

  const response = await fetch(
    restUrl(
      config,
      "users",
      [
        `user_uuid=in.(${unique_user_uuids.map(encodeURIComponent).join(",")})`,
        "select=user_uuid,role",
      ].join("&"),
    ),
    {
      headers: restHeaders(config),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    return role_map
  }

  const users = (await response.json()) as UserRow[]

  for (const user of users) {
    if (user.user_uuid && user.role) {
      role_map.set(user.user_uuid, user.role)
    }
  }

  return role_map
}

async function loadRoomParticipantUserMap(room_uuid: string) {
  const participant_map = new Map<string, string>()
  const { getRestConfig, restHeaders, restUrl } = await import("@/core/db/rest")
  const config = getRestConfig()

  if (!config) {
    return participant_map
  }

  const response = await fetch(
    restUrl(
      config,
      "participants",
      [
        `room_uuid=eq.${encodeURIComponent(room_uuid)}`,
        "user_uuid=not.is.null",
        "select=user_uuid,participant_uuid",
      ].join("&"),
    ),
    {
      headers: restHeaders(config),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    return participant_map
  }

  const participants = (await response.json()) as Array<{
    user_uuid?: string | null
    participant_uuid?: string | null
  }>

  for (const participant of participants) {
    if (participant.user_uuid && participant.participant_uuid) {
      participant_map.set(participant.user_uuid, participant.participant_uuid)
    }
  }

  return participant_map
}

async function loadReceiverLineProviderUserId(user_uuid: string) {
  const { getRestConfig, restHeaders, restUrl } = await import("@/core/db/rest")
  const config = getRestConfig()

  if (!config) {
    return null
  }

  const response = await fetch(
    restUrl(
      config,
      "identities",
      [
        `user_uuid=eq.${encodeURIComponent(user_uuid)}`,
        "provider=eq.line",
        "provider_user_id=not.is.null",
        "select=provider_user_id",
        "order=created_at.desc",
        "limit=1",
      ].join("&"),
    ),
    {
      headers: restHeaders(config),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    return null
  }

  const rows = (await response.json()) as Array<{
    provider_user_id?: string | null
  }>

  return rows[0]?.provider_user_id?.trim() || null
}

export async function resolveChatNotifyRoutes(input: {
  room_uuid: string
  sender_uuid?: string | null
  sender_role: string
  request_id?: string | null
}): Promise<ChatNotifyContactRoute[]> {
  const { sendNotifyDebug } = await import("@/core/notify/debug")
  const { loadOnlineRoomPresence } = await import("@/core/chat/presence")

  const receiver_user_uuids = await loadRoomReceiverUserUuids({
    room_uuid: input.room_uuid,
    sender_uuid: input.sender_uuid ?? null,
    sender_role: input.sender_role,
  })

  if (receiver_user_uuids.length === 0) {
    return []
  }

  const entered_participant_uuids = new Set(
    (await loadOnlineRoomPresence(input.room_uuid))
      .map((presence) => presence.participant_uuid)
      .filter(Boolean),
  )
  const participant_user_map = await loadRoomParticipantUserMap(input.room_uuid)
  const receiver_role_map = await loadReceiverUserRoles(receiver_user_uuids)
  const routes: ChatNotifyContactRoute[] = []

  for (const receiver_user_uuid of receiver_user_uuids) {
    const contacts = await loadReceiverContacts(receiver_user_uuid)
    const contact = contacts[0] ?? null
    const receiver_role = receiver_role_map.get(receiver_user_uuid) ?? null
    const participant_uuid = participant_user_map.get(receiver_user_uuid) ?? null
    const in_room = Boolean(
      participant_uuid && entered_participant_uuids.has(participant_uuid),
    )
    const line_provider_user_id =
      await loadReceiverLineProviderUserId(receiver_user_uuid)

    const contact_candidates = contacts.map((row) => ({
      contact_uuid: row.contact_uuid ?? null,
      contact_type: row.type ?? null,
      receive: row.receive ?? null,
      state: row.state ?? null,
      channel: row.channel ?? null,
      has_value: Boolean(row.value?.trim()),
      has_endpoint: Boolean(row.endpoint?.trim()),
      has_p256dh: Boolean(row.p256dh?.trim()),
      has_auth: Boolean(row.auth?.trim()),
      valid_push: isValidPushContact(row),
    }))

    await sendNotifyDebug("notify_contact_candidates", {
      room_uuid: input.room_uuid,
      sender_uuid: input.sender_uuid ?? null,
      receiver_uuid: receiver_user_uuid,
      receiver_role,
      in_room,
      contact_state: contact?.state ?? null,
      contact_count: contacts.length,
      contacts: contact_candidates,
      request_id: input.request_id ?? null,
    })

    const resolved = resolveReceiverNotifyDelivery({
      in_room,
      contact,
      receiver_role,
      line_provider_user_id,
    })

    await sendNotifyDebug("notify_contact_selected", {
      room_uuid: input.room_uuid,
      sender_uuid: input.sender_uuid ?? null,
      receiver_uuid: receiver_user_uuid,
      receiver_role,
      in_room,
      contact_uuid: resolved.selected_contact?.contact_uuid ?? null,
      contact_type: resolved.selected_contact?.contact_type ?? null,
      receive: resolved.selected_contact?.receive ?? null,
      contact_state: contact?.state ?? null,
      channel: resolved.selected_contact?.channel ?? null,
      delivery: resolved.delivery,
      line_user_id: resolved.line_user_id,
      skipped_reason: resolved.skipped_reason,
      request_id: input.request_id ?? null,
    })

    routes.push({
      receiver_user_uuid,
      receiver_role,
      in_room,
      contact_state: contact?.state ?? null,
      delivery: resolved.delivery,
      selected_contact: resolved.selected_contact,
      line_user_id: resolved.line_user_id,
      skipped_reason: resolved.skipped_reason,
    })
  }

  return routes
}
