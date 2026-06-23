import type { ChatRoomMode } from "@/core/chat/types"

export type NotifyEventName =
  | "admin_page_accessed"
  | "admin_page_unauthorized_access"
  | "concierge_admin_entered"
  | "concierge_admin_left"
  | "concierge_admin_message"
  | "concierge_closed"
  | "concierge_requested"
  | "driver_page_unauthorized_access"
  | "driver_provisional_registered"
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

  if (input.event === "driver_provisional_registered") {
    return {
      channel: "discord",
      webhook_url,
      title: "新しいドライバーの仮登録がありました",
      event: input.event,
      priority: "normal",
      mention,
      summary: "driver provisional registration completed",
      format: "plain",
      embed_color: null,
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
  resolved_receiver_uuid: string
  receiver_user_uuid: string
  receiver_participant_uuid: string | null
  receiver_role: string | null
  in_room: boolean
  raw_in_room: boolean
  presence_status: string | null
  left_at: string | null
  last_seen_at: string | null
  last_seen_age_seconds: number | null
  presence_stale_threshold_seconds: number
  presence_is_stale: boolean
  presence_reason: string
  contact_state: string | null
  delivery: import("@/core/notify/chat_rules").ChatNotifyDeliveryKind
  selected_contact: ChatNotifySelectedContact | null
  line_user_id: string | null
  line_user_id_source: "contacts.value" | "identities" | null
  skipped_reason?: string | null
}

type ParticipantRow = {
  participant_uuid?: string | null
  user_uuid?: string | null
  visitor_uuid?: string | null
  role?: string | null
}

type ChatNotifyReceiver = {
  participant_uuid: string | null
  receiver_user_uuid: string
  receiver_role: string
}

type AvailabilityRow = {
  user_uuid?: string | null
  enabled?: boolean | null
}

type UserRow = {
  user_uuid?: string | null
  role?: string | null
}

type ContactRow = {
  contact_uuid?: string | null
  user_uuid?: string | null
  visitor_uuid?: string | null
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

type NotifyRoomRow = {
  mode?: ChatRoomMode | null
}

const ROOM_PRESENCE_STALE_THRESHOLD_SECONDS = 60

function isContactInApp(state: string | null | undefined) {
  return state === "active" || state === "online"
}

function isContactAway(state: string | null | undefined) {
  return (
    state === "hidden" ||
    state === "background" ||
    state === "offline" ||
    state === "away" ||
    state === "inactive"
  )
}

function resolveEffectiveContactState(contact: ContactRow | null) {
  const state = contact?.state ?? null

  if (state !== "active" && state !== "online") {
    return state
  }

  const last_seen_age_seconds = calculateLastSeenAgeSeconds(contact?.last_seen_at)

  if (
    last_seen_age_seconds === null ||
    last_seen_age_seconds > ROOM_PRESENCE_STALE_THRESHOLD_SECONDS
  ) {
    return "offline"
  }

  return state
}

function isStaffRole(role: string | null | undefined) {
  return role === "admin" || role === "concierge" || role === "owner"
}

function isCustomerRole(role: string | null | undefined) {
  return role === "user" || role === "guest"
}

function isStaffSender(sender_role: string) {
  return isStaffRole(sender_role)
}

function isCustomerSender(sender_role: string) {
  return isCustomerRole(sender_role)
}

function participantMatchesSender(
  participant: ParticipantRow,
  input: {
    sender_uuid: string | null
    sender_participant_uuid?: string | null
  },
) {
  if (
    input.sender_participant_uuid &&
    participant.participant_uuid === input.sender_participant_uuid
  ) {
    return true
  }

  if (input.sender_uuid && participant.user_uuid === input.sender_uuid) {
    return true
  }

  return false
}


function requiresAvailabilityGate(receiver_role: string | null | undefined) {
  return isStaffRole(receiver_role)
}

function isAdminReceiverRole(role: string | null | undefined) {
  return role === "admin" || role === "owner"
}

function calculateLastSeenAgeSeconds(last_seen_at: string | null | undefined) {
  if (!last_seen_at) {
    return null
  }

  const last_seen_time = new Date(last_seen_at).getTime()

  if (Number.isNaN(last_seen_time)) {
    return null
  }

  return Math.max(0, Math.floor((Date.now() - last_seen_time) / 1000))
}

function resolveRoomPresenceState(input: {
  room_uuid: string
  participant_uuid: string | null
  presence:
    | {
        room_uuid: string
        participant_uuid: string
        status: string
        left_at: string | null
        last_seen_at: string | null
      }
    | null
}) {
  const raw_in_room = Boolean(
    input.participant_uuid &&
      input.presence &&
      input.presence.room_uuid === input.room_uuid &&
      input.presence.participant_uuid === input.participant_uuid &&
      (input.presence.status === "entered" ||
        input.presence.status === "active") &&
      !input.presence.left_at,
  )
  const last_seen_age_seconds = calculateLastSeenAgeSeconds(
    input.presence?.last_seen_at ?? null,
  )
  const is_recent =
    raw_in_room &&
    last_seen_age_seconds !== null &&
    last_seen_age_seconds <= ROOM_PRESENCE_STALE_THRESHOLD_SECONDS
  const is_stale = raw_in_room && !is_recent
  const is_in_room = raw_in_room && is_recent
  const reason = is_stale
    ? "room_presence_stale"
    : is_in_room
      ? "receiver_in_room"
      : "receiver_not_in_room"

  return {
    is_in_room,
    raw_in_room,
    last_seen_age_seconds,
    stale_threshold_seconds: ROOM_PRESENCE_STALE_THRESHOLD_SECONDS,
    is_stale,
    reason,
  }
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
  contact_line_user_id: string | null
  contact_line_user_id_source: "contacts.value" | null
}): {
  delivery: import("@/core/notify/chat_rules").ChatNotifyDeliveryKind
  selected_contact: ChatNotifySelectedContact | null
  line_user_id: string | null
  line_user_id_source: "contacts.value" | "identities" | null
  skipped_reason: string | null
} {
  if (input.in_room) {
    return {
      delivery: "none",
      selected_contact: null,
      line_user_id: null,
      line_user_id_source: null,
      skipped_reason: "receiver_in_room",
    }
  }

  const contact = input.contact
  const state = resolveEffectiveContactState(contact)
  const is_admin_receiver = isAdminReceiverRole(input.receiver_role)
  const line_user_id = is_admin_receiver
    ? input.line_provider_user_id
    : input.contact_line_user_id ?? input.line_provider_user_id
  const line_user_id_source = is_admin_receiver
    ? (input.line_provider_user_id ? "identities" : null)
    : input.contact_line_user_id
      ? input.contact_line_user_id_source
      : input.line_provider_user_id
        ? "identities"
        : null

  if (!contact) {
    return {
      delivery: "none",
      selected_contact: null,
      line_user_id: null,
      line_user_id_source: null,
      skipped_reason: "contact_missing",
    }
  }

  if (contact.receive !== true) {
    return {
      delivery: "none",
      selected_contact: null,
      line_user_id: null,
      line_user_id_source: null,
      skipped_reason: "contact_receive_disabled",
    }
  }

  if (isContactInApp(state)) {
    return {
      delivery: "none",
      selected_contact: null,
      line_user_id: null,
      line_user_id_source: null,
      skipped_reason: "receiver_active",
    }
  }

  if (!isContactAway(state)) {
    return {
      delivery: "none",
      selected_contact: null,
      line_user_id: null,
      line_user_id_source: null,
      skipped_reason: "contact_state_unknown",
    }
  }

  if (contact && isValidPushContact(contact)) {
    return {
      delivery: "push",
      selected_contact: toSelectedPushContact(contact),
      line_user_id: null,
      line_user_id_source: null,
      skipped_reason: null,
    }
  }

  if (contact.type === "line" || is_admin_receiver) {
    if (!line_user_id) {
      return {
        delivery: "none",
        selected_contact: null,
        line_user_id: null,
        line_user_id_source: null,
        skipped_reason: "line_target_missing",
      }
    }

    return {
      delivery: "line",
      selected_contact: {
        contact_uuid: contact?.contact_uuid ?? null,
        contact_type: "line",
        contact_value: line_user_id,
        receive: contact?.receive ?? null,
        state,
        channel: contact?.channel ?? null,
        push_subscription: null,
      },
      line_user_id,
      line_user_id_source,
      skipped_reason: null,
    }
  }

  if (line_user_id) {
    return {
      delivery: "line",
      selected_contact: {
        contact_uuid: contact?.contact_uuid ?? null,
        contact_type: "line",
        contact_value: line_user_id,
        receive: contact?.receive ?? null,
        state,
        channel: contact?.channel ?? null,
        push_subscription: null,
      },
      line_user_id,
      line_user_id_source,
      skipped_reason: null,
    }
  }

  return {
    delivery: "none",
    selected_contact: null,
    line_user_id: null,
    line_user_id_source: null,
    skipped_reason:
      contact.type === "push" && !isValidPushContact(contact)
        ? "push_target_missing"
        : "line_target_missing",
  }
}

async function loadReceiverAvailabilityMap(user_uuids: string[]) {
  const unique_user_uuids = [...new Set(user_uuids)].filter(Boolean)
  const availability_map = new Map<string, boolean>()

  if (unique_user_uuids.length === 0) {
    return availability_map
  }

  const { getRestConfig, restHeaders, restUrl } = await import("@/core/db/rest")
  const config = getRestConfig()

  if (!config) {
    return availability_map
  }

  const response = await fetch(
    restUrl(
      config,
      "availability",
      [
        `user_uuid=in.(${unique_user_uuids.map(encodeURIComponent).join(",")})`,
        "select=user_uuid,enabled",
      ].join("&"),
    ),
    {
      headers: restHeaders(config),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    return availability_map
  }

  const rows = (await response.json()) as AvailabilityRow[]

  for (const row of rows) {
    if (row.user_uuid) {
      availability_map.set(row.user_uuid, row.enabled === true)
    }
  }

  return availability_map
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

async function loadRoomParticipantsForNotify(room_uuid: string) {
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
        `room_uuid=eq.${encodeURIComponent(room_uuid)}`,
        "role=not.eq.bot",
        "select=participant_uuid,user_uuid,visitor_uuid,role",
        "order=joined_at.asc",
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

  return (await response.json()) as ParticipantRow[]
}

async function loadEnabledAvailabilityUserUuids() {
  const { getRestConfig, restHeaders, restUrl } = await import("@/core/db/rest")
  const config = getRestConfig()

  if (!config) {
    return []
  }

  const response = await fetch(
    restUrl(config, "availability", "enabled=eq.true&select=user_uuid"),
    {
      headers: restHeaders(config),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    return []
  }

  const rows = (await response.json()) as AvailabilityRow[]

  return rows
    .map((row) => row.user_uuid)
    .filter((user_uuid): user_uuid is string => Boolean(user_uuid))
}

async function resolveRoomNotificationReceivers(input: {
  room_uuid: string
  sender_uuid: string | null
  sender_participant_uuid?: string | null
  sender_role: string
  request_id?: string | null
}): Promise<ChatNotifyReceiver[]> {
  const { sendNotifyDebug } = await import("@/core/notify/debug")

  await sendNotifyDebug("notification_receiver_resolve_started", {
    room_uuid: input.room_uuid,
    sender_uuid: input.sender_uuid,
    sender_role: input.sender_role,
    request_id: input.request_id ?? null,
  })

  const participants = await loadRoomParticipantsForNotify(input.room_uuid)
  const participant_count = participants.length
  const receivers: ChatNotifyReceiver[] = []

  if (isCustomerSender(input.sender_role)) {
    for (const participant of participants) {
      if (!isStaffRole(participant.role)) {
        continue
      }

      if (participantMatchesSender(participant, input)) {
        continue
      }

      if (!participant.user_uuid) {
        continue
      }

      receivers.push({
        participant_uuid: participant.participant_uuid ?? null,
        receiver_user_uuid: participant.user_uuid,
        receiver_role: participant.role ?? "concierge",
      })
    }

    const included_user_uuids = new Set(
      receivers
        .map((receiver) => receiver.receiver_user_uuid)
        .filter((user_uuid): user_uuid is string => Boolean(user_uuid)),
    )
    const enabled_user_uuids = await loadEnabledAvailabilityUserUuids()
    const missing_user_uuids = enabled_user_uuids.filter(
      (user_uuid) =>
        user_uuid !== input.sender_uuid && !included_user_uuids.has(user_uuid),
    )
    const role_map = await loadReceiverUserRoles(missing_user_uuids)

    for (const user_uuid of missing_user_uuids) {
      const receiver_role = role_map.get(user_uuid) ?? null

      if (!isStaffRole(receiver_role)) {
        continue
      }

      receivers.push({
        participant_uuid: null,
        receiver_user_uuid: user_uuid,
        receiver_role: receiver_role ?? "concierge",
      })
    }
  } else if (isStaffSender(input.sender_role)) {
    for (const participant of participants) {
      if (!isCustomerRole(participant.role)) {
        continue
      }

      if (participantMatchesSender(participant, input)) {
        continue
      }

      if (!participant.user_uuid) {
        continue
      }

      receivers.push({
        participant_uuid: participant.participant_uuid ?? null,
        receiver_user_uuid: participant.user_uuid,
        receiver_role: participant.role ?? "user",
      })
    }
  }

  if (receivers.length === 0) {
    await sendNotifyDebug("notification_receiver_resolve_failed", {
      room_uuid: input.room_uuid,
      sender_uuid: input.sender_uuid,
      sender_role: input.sender_role,
      resolved_receiver_uuid: null,
      resolved_receiver_role: null,
      participant_count,
      reason: "no_receiver",
      request_id: input.request_id ?? null,
    })

    return []
  }

  for (const receiver of receivers) {
    await sendNotifyDebug("notification_receiver_resolve_success", {
      room_uuid: input.room_uuid,
      sender_uuid: input.sender_uuid,
      sender_role: input.sender_role,
      resolved_receiver_uuid: receiver.receiver_user_uuid,
      resolved_receiver_role: receiver.receiver_role,
      participant_count,
      reason: null,
      request_id: input.request_id ?? null,
    })
  }

  return receivers
}

async function loadReceiverContacts(user_uuid: string) {
  const { getRestConfig, restHeaders, restUrl } = await import("@/core/db/rest")
  const config = getRestConfig()

  if (!config || !user_uuid) {
    return []
  }

  const response = await fetch(
    restUrl(
      config,
      "contacts",
      [
        `user_uuid=eq.${encodeURIComponent(user_uuid)}`,
        "select=contact_uuid,user_uuid,visitor_uuid,type,value,endpoint,p256dh,auth,channel,state,receive,last_seen_at,updated_at",
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

async function loadRoomModeForNotify(
  room_uuid: string,
): Promise<ChatRoomMode | null> {
  const { getRestConfig, restHeaders, restUrl } = await import("@/core/db/rest")
  const config = getRestConfig()

  if (!config) {
    return null
  }

  const response = await fetch(
    restUrl(
      config,
      "rooms",
      [
        `room_uuid=eq.${encodeURIComponent(room_uuid)}`,
        "select=mode",
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

  const rows = (await response.json()) as NotifyRoomRow[]
  const mode = rows[0]?.mode ?? null

  if (mode === "bot" || mode === "concierge" || mode === "group") {
    return mode
  }

  return null
}

function resolveNotifyMessageSource(input: {
  message_source?: string | null
  sender_role: string
}) {
  if (input.message_source) {
    return input.message_source
  }

  if (isStaffSender(input.sender_role)) {
    return "concierge"
  }

  if (input.sender_role === "bot") {
    return "bot"
  }

  return "user"
}

type ResolveChatNotifyRoutesInput = {
  room_uuid: string
  sender_uuid?: string | null
  sender_participant_uuid?: string | null
  sender_role: string
  message_uuid?: string | null
  message_text?: string | null
  message_source?: string | null
  source_channel?: string | null
  request_id?: string | null
}

export type ChatNotifyRouteResolution = {
  routes: ChatNotifyContactRoute[]
  skipped_reason: string | null
  room_mode: ChatRoomMode | null
  notification_allowed: boolean
}

export async function resolveChatNotifyRouteResolution(
  input: ResolveChatNotifyRoutesInput,
): Promise<ChatNotifyRouteResolution> {
  const { sendNotifyDebug } = await import("@/core/notify/debug")
  const { loadRoomPresence } = await import("@/core/chat/presence")
  const room_mode = await loadRoomModeForNotify(input.room_uuid)
  const notification_allowed = room_mode === "concierge"
  const notification_reason = notification_allowed
    ? "room_mode_concierge"
    : room_mode
      ? "room_mode_not_concierge"
      : "room_mode_unknown"
  const message_source = resolveNotifyMessageSource({
    message_source: input.message_source ?? null,
    sender_role: input.sender_role,
  })

  await sendNotifyDebug("notification_room_mode_checked", {
    room_uuid: input.room_uuid,
    channel: input.source_channel ?? null,
    sender_role: input.sender_role,
    message_source,
    room_mode,
    notification_allowed,
    notification_reason,
    request_id: input.request_id ?? null,
  })

  if (!notification_allowed) {
    await sendNotifyDebug("notification_route_decided", {
      message_uuid: input.message_uuid ?? input.request_id ?? null,
      room_uuid: input.room_uuid,
      sender_uuid: input.sender_uuid ?? null,
      receiver_uuid: null,
      should_notify: false,
      delivery_channel: null,
      reason: notification_reason,
      request_id: input.request_id ?? null,
    })

    return {
      routes: [],
      skipped_reason: notification_reason,
      room_mode,
      notification_allowed,
    }
  }

  const receivers = await resolveRoomNotificationReceivers({
    room_uuid: input.room_uuid,
    sender_uuid: input.sender_uuid ?? null,
    sender_participant_uuid: input.sender_participant_uuid ?? null,
    sender_role: input.sender_role,
    request_id: input.request_id ?? null,
  })

  if (receivers.length === 0) {
    return {
      routes: [],
      skipped_reason: "no_receiver",
      room_mode,
      notification_allowed,
    }
  }

  const room_presence = await loadRoomPresence(input.room_uuid)
  const latest_presence_by_participant = new Map(
    room_presence.map((presence) => [presence.participant_uuid, presence]),
  )
  const staff_receiver_user_uuids = receivers
    .filter((receiver) => requiresAvailabilityGate(receiver.receiver_role))
    .map((receiver) => receiver.receiver_user_uuid)
    .filter((user_uuid): user_uuid is string => Boolean(user_uuid))
  const availability_map = await loadReceiverAvailabilityMap(
    staff_receiver_user_uuids,
  )
  const routes: ChatNotifyContactRoute[] = []

  for (const receiver of receivers) {
    const receiver_user_uuid = receiver.receiver_user_uuid

    await sendNotifyDebug("notification_receiver_resolved", {
      room_uuid: input.room_uuid,
      sender_uuid: input.sender_uuid ?? null,
      receiver_participant_uuid: receiver.participant_uuid,
      receiver_user_uuid,
      receiver_role: receiver.receiver_role,
      request_id: input.request_id ?? null,
    })

    const contacts = await loadReceiverContacts(receiver_user_uuid)
    const contact = contacts[0] ?? null
    const availability_enabled = requiresAvailabilityGate(receiver.receiver_role)
      ? availability_map.get(receiver_user_uuid) === true
      : true
    const participant_uuid = receiver.participant_uuid
    const presence = participant_uuid
      ? latest_presence_by_participant.get(participant_uuid) ?? null
      : null
    const presence_state = resolveRoomPresenceState({
      room_uuid: input.room_uuid,
      participant_uuid,
      presence,
    })
    const in_room = presence_state.is_in_room
    const line_provider_user_id =
      await loadReceiverLineProviderUserId(receiver_user_uuid)
    const contact_line_user_id =
      contact?.type === "line" ? contact.value?.trim() || null : null
    const contact_line_user_id_source = contact_line_user_id
      ? ("contacts.value" as const)
      : null
    const resolved_receiver_uuid = receiver_user_uuid
    const contact_owner_matches =
      !contact || contact.user_uuid === receiver_user_uuid

    await sendNotifyDebug("notification_trigger_created", {
      message_uuid: input.message_uuid ?? input.request_id ?? null,
      room_uuid: input.room_uuid,
      sender_uuid: input.sender_uuid ?? null,
      sender_role: input.sender_role,
      receiver_uuid: resolved_receiver_uuid,
      receiver_role: receiver.receiver_role,
      source_channel: input.source_channel ?? null,
      request_id: input.request_id ?? null,
    })

    await sendNotifyDebug("notification_rule_started", {
      message_uuid: input.message_uuid ?? input.request_id ?? null,
      room_uuid: input.room_uuid,
      receiver_uuid: resolved_receiver_uuid,
      request_id: input.request_id ?? null,
    })

    await sendNotifyDebug("notification_availability_checked", {
      receiver_uuid: resolved_receiver_uuid,
      enabled: availability_enabled,
      reason: availability_enabled ? "availability_on" : "availability_off",
      request_id: input.request_id ?? null,
    })

    await sendNotifyDebug("notification_presence_checked", {
      room_uuid: input.room_uuid,
      receiver_uuid: resolved_receiver_uuid,
      is_in_room: in_room,
      raw_is_in_room: presence_state.raw_in_room,
      presence_status: presence?.status ?? null,
      left_at: presence?.left_at ?? null,
      last_seen_at: presence?.last_seen_at ?? null,
      last_seen_age_seconds: presence_state.last_seen_age_seconds,
      stale_threshold_seconds: presence_state.stale_threshold_seconds,
      is_stale: presence_state.is_stale,
      reason: presence_state.reason,
      request_id: input.request_id ?? null,
    })

    await sendNotifyDebug("notification_contact_checked", {
      receiver_uuid: resolved_receiver_uuid,
      contact_uuid: contact?.contact_uuid ?? null,
      contact_user_uuid: contact?.user_uuid ?? null,
      contact_visitor_uuid: contact?.visitor_uuid ?? null,
      type: contact?.type ?? null,
      channel: contact?.channel ?? null,
      state: contact?.state ?? null,
      receive: contact?.receive ?? null,
      has_line_value:
        contact?.type === "line" && Boolean(contact.value?.trim()),
      has_push_endpoint: Boolean(contact?.endpoint?.trim()),
      has_p256dh: Boolean(contact?.p256dh?.trim()),
      has_auth: Boolean(contact?.auth?.trim()),
      request_id: input.request_id ?? null,
    })

    if (!contact_owner_matches) {
      await sendNotifyDebug("notification_contact_owner_mismatch", {
        room_uuid: input.room_uuid,
        sender_uuid: input.sender_uuid ?? null,
        receiver_uuid: resolved_receiver_uuid,
        receiver_user_uuid,
        contact_uuid: contact?.contact_uuid ?? null,
        contact_user_uuid: contact?.user_uuid ?? null,
        contact_visitor_uuid: contact?.visitor_uuid ?? null,
        request_id: input.request_id ?? null,
      })

      await sendNotifyDebug("notification_route_decided", {
        receiver_uuid: resolved_receiver_uuid,
        should_notify: false,
        reason: "contact_owner_mismatch",
        delivery_channel: null,
        message_text: input.message_text ?? null,
        request_id: input.request_id ?? null,
      })

      routes.push({
        resolved_receiver_uuid,
        receiver_user_uuid,
        receiver_participant_uuid: receiver.participant_uuid,
        receiver_role: receiver.receiver_role,
        in_room,
        raw_in_room: presence_state.raw_in_room,
        presence_status: presence?.status ?? null,
        left_at: presence?.left_at ?? null,
        last_seen_at: presence?.last_seen_at ?? null,
        last_seen_age_seconds: presence_state.last_seen_age_seconds,
        presence_stale_threshold_seconds: presence_state.stale_threshold_seconds,
        presence_is_stale: presence_state.is_stale,
        presence_reason: presence_state.reason,
        contact_state: contact?.state ?? null,
        delivery: "none",
        selected_contact: null,
        line_user_id: null,
        line_user_id_source: null,
        skipped_reason: "contact_owner_mismatch",
      })

      continue
    }

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
      receiver_uuid: resolved_receiver_uuid,
      receiver_role: receiver.receiver_role,
      in_room,
      raw_in_room: presence_state.raw_in_room,
      contact_state: contact?.state ?? null,
      contact_count: contacts.length,
      contacts: contact_candidates,
      request_id: input.request_id ?? null,
    })

    const resolved = availability_enabled
      ? resolveReceiverNotifyDelivery({
          in_room,
          contact,
          receiver_role: receiver.receiver_role,
          line_provider_user_id,
          contact_line_user_id,
          contact_line_user_id_source,
        })
      : {
          delivery: "none" as const,
          selected_contact: null,
          line_user_id: null,
          line_user_id_source: null,
          skipped_reason: "availability_off" as const,
        }

    if (contact?.type === "push" && resolved.delivery !== "push") {
      await sendNotifyDebug("notify_push_overridden", {
        room_uuid: input.room_uuid,
        sender_uuid: input.sender_uuid ?? null,
        receiver_uuid: resolved_receiver_uuid,
        reason: resolved.skipped_reason ?? "push_not_selected",
        contact_type: contact.type,
        has_endpoint: Boolean(contact.endpoint?.trim()),
        has_p256dh: Boolean(contact.p256dh?.trim()),
        has_auth: Boolean(contact.auth?.trim()),
        delivery: resolved.delivery,
        request_id: input.request_id ?? null,
      })
    }

    await sendNotifyDebug("notify_contact_selected", {
      room_uuid: input.room_uuid,
      sender_uuid: input.sender_uuid ?? null,
      receiver_uuid: resolved_receiver_uuid,
      receiver_role: receiver.receiver_role,
      in_room,
      raw_in_room: presence_state.raw_in_room,
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

    await sendNotifyDebug("notification_route_decided", {
      receiver_uuid: resolved_receiver_uuid,
      should_notify: resolved.delivery !== "none",
      reason:
        resolved.skipped_reason ??
        (presence_state.is_stale && resolved.delivery !== "none"
          ? presence_state.reason
          : null) ??
        (resolved.delivery === "push"
          ? `${contact?.state ?? "unknown"}_push_selected`
          : `${contact?.state ?? "unknown"}_line_selected`),
      delivery_channel: resolved.delivery === "none" ? null : resolved.delivery,
      message_text: input.message_text ?? null,
      request_id: input.request_id ?? null,
    })

    if (
      resolved.delivery === "line" ||
      resolved.skipped_reason === "line_target_missing"
    ) {
      await sendNotifyDebug("notification_line_target_resolved", {
        receiver_uuid: resolved_receiver_uuid,
        source: resolved.line_user_id_source,
        has_line_user_id: Boolean(resolved.line_user_id),
        request_id: input.request_id ?? null,
      })
    }

    if (
      resolved.delivery === "push" ||
      resolved.skipped_reason === "push_target_missing"
    ) {
      await sendNotifyDebug("notification_push_target_resolved", {
        receiver_uuid: resolved_receiver_uuid,
        has_endpoint: Boolean(resolved.selected_contact?.push_subscription?.endpoint),
        has_p256dh: Boolean(
          resolved.selected_contact?.push_subscription?.keys?.p256dh,
        ),
        has_auth: Boolean(
          resolved.selected_contact?.push_subscription?.keys?.auth,
        ),
        request_id: input.request_id ?? null,
      })
    }

    routes.push({
      resolved_receiver_uuid,
      receiver_user_uuid,
      receiver_participant_uuid: receiver.participant_uuid,
      receiver_role: receiver.receiver_role,
      in_room,
      raw_in_room: presence_state.raw_in_room,
      presence_status: presence?.status ?? null,
      left_at: presence?.left_at ?? null,
      last_seen_at: presence?.last_seen_at ?? null,
      last_seen_age_seconds: presence_state.last_seen_age_seconds,
      presence_stale_threshold_seconds: presence_state.stale_threshold_seconds,
      presence_is_stale: presence_state.is_stale,
      presence_reason: presence_state.reason,
      contact_state: contact?.state ?? null,
      delivery: resolved.delivery,
      selected_contact: resolved.selected_contact,
      line_user_id: resolved.line_user_id,
      line_user_id_source: resolved.line_user_id_source,
      skipped_reason: resolved.skipped_reason,
    })
  }

  return {
    routes,
    skipped_reason: null,
    room_mode,
    notification_allowed,
  }
}

export async function resolveChatNotifyRoutes(
  input: ResolveChatNotifyRoutesInput,
): Promise<ChatNotifyContactRoute[]> {
  const resolution = await resolveChatNotifyRouteResolution(input)

  return resolution.routes
}

export * from "@/core/notify/settings_rules"
