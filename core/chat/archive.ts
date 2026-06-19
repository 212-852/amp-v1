import { getRestConfig, readRestError, restHeaders, restUrl } from "@/core/db/rest"
import { sendAuthDebug } from "@/core/debug"
import type {
  AvailabilityRecord,
  ChatLocale,
  ChatMessageRecord,
  ChatMessageStatus,
  ChatMessageType,
  ChatParticipantRecord,
  ChatParticipantRole,
  ChatRoomMode,
  ChatRoomRecord,
} from "@/core/chat/types"

function requireConfig() {
  const config = getRestConfig()

  if (!config) {
    throw new Error("Database is unavailable")
  }

  return config
}

function isMissingRoomIdentityColumn(error: {
  code?: string | null
  message?: string | null
}) {
  return (
    error.code === "PGRST204" &&
    (error.message?.includes("'user_uuid' column") === true ||
      error.message?.includes("'visitor_uuid' column") === true ||
      error.message?.includes("'order_uuid' column") === true)
  )
}

function isMissingRoomKeyColumn(error: {
  code?: string | null
  message?: string | null
}) {
  return (
    error.code === "PGRST204" &&
    error.message?.includes("'room_key' column") === true
  )
}

export async function loadConciergeAvailability(user_uuid?: string | null) {
  const config = getRestConfig()

  if (!config) {
    return true
  }

  const filter = user_uuid
    ? `user_uuid=eq.${encodeURIComponent(user_uuid)}&select=enabled&limit=1`
    : "enabled=eq.true&select=user_uuid&limit=1"

  const response = await fetch(restUrl(config, "availability", filter), {
    headers: restHeaders(config),
    cache: "no-store",
  })

  if (!response.ok) {
    return false
  }

  const rows = (await response.json()) as Array<
    Pick<AvailabilityRecord, "enabled" | "user_uuid">
  >

  if (user_uuid) {
    return rows[0]?.enabled ?? false
  }

  return rows.length > 0
}

export async function setConciergeAvailability(input: {
  available: boolean
  updated_by: string | null
}) {
  const config = getRestConfig()

  if (!config) {
    return { enabled: input.available }
  }

  if (!input.updated_by) {
    throw new Error("user_uuid is required")
  }

  const upsert_body: AvailabilityRecord = {
    user_uuid: input.updated_by,
    enabled: input.available,
    updated_at: new Date().toISOString(),
  }

  const response = await fetch(
    restUrl(config, "availability", "on_conflict=user_uuid"),
    {
      method: "POST",
      headers: {
        ...restHeaders(config),
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify(upsert_body),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    const error = await readRestError(response)
    throw new Error(
      `Failed to update availability: ${error.message ?? "unknown"}`,
    )
  }

  const rows = (await response.json()) as AvailabilityRecord[]
  const enabled = rows[0]?.enabled ?? input.available

  return { enabled }
}

async function findParticipantRow(filter: string) {
  const config = getRestConfig()

  if (!config) {
    return null
  }

  const response = await fetch(
    restUrl(config, "participants", `${filter}&select=*&order=joined_at.asc&limit=1`),
    {
      headers: restHeaders(config),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    const error = await readRestError(response)

    if (isMissingExternalIdColumn(error)) {
      return null
    }

    return null
  }

  const rows = (await response.json()) as ChatParticipantRecord[]
  return rows[0] ?? null
}

export async function findOldestParticipantByUserUuid(user_uuid: string) {
  return findParticipantRow(
    `user_uuid=eq.${encodeURIComponent(user_uuid)}&role=in.(guest,user)`,
  )
}

export async function findOldestParticipantByVisitorUuid(visitor_uuid: string) {
  return findParticipantRow(
    `visitor_uuid=eq.${encodeURIComponent(visitor_uuid)}&role=in.(guest,user)`,
  )
}

export async function findOwnerParticipantInRoom(input: {
  room_uuid: string
  user_uuid: string | null
  visitor_uuid: string | null
  role?: ChatParticipantRole | null
}) {
  const role_filter = input.role
    ? `&role=eq.${encodeURIComponent(input.role)}`
    : ""

  if (input.user_uuid) {
    const by_user = await findParticipantRow(
      `room_uuid=eq.${encodeURIComponent(input.room_uuid)}&user_uuid=eq.${encodeURIComponent(input.user_uuid)}${role_filter}`,
    )

    if (by_user) {
      return by_user
    }
  }

  if (input.visitor_uuid) {
    return findParticipantRow(
      `room_uuid=eq.${encodeURIComponent(input.room_uuid)}&visitor_uuid=eq.${encodeURIComponent(input.visitor_uuid)}${role_filter}`,
    )
  }

  return null
}

export type ResolvedOwnerParticipant = {
  room: ChatRoomRecord
  participant: ChatParticipantRecord
  found_by: "user_uuid" | "visitor_uuid" | "room_key"
}

/** @deprecated Import from @/core/chat/participant */
export async function resolveRoomFromParticipants(input: {
  visitor_uuid: string | null
  user_uuid: string | null
  mode?: ChatRoomMode
}): Promise<ResolvedOwnerParticipant | null> {
  const { resolveOwnedParticipant } = await import("@/core/chat/participant")
  void input.mode
  return resolveOwnedParticipant(input)
}

/** @deprecated Use resolveRoomFromParticipants */
export async function findRoomForIdentity(input: {
  visitor_uuid: string | null
  user_uuid: string | null
}) {
  const resolved = await resolveRoomFromParticipants(input)
  return resolved?.room ?? null
}

export async function findVisitorUuidByUser(user_uuid: string) {
  const config = getRestConfig()

  if (!config) {
    return null
  }

  const response = await fetch(
    restUrl(
      config,
      "visitors",
      `user_uuid=eq.${encodeURIComponent(user_uuid)}&select=visitor_uuid&order=created_at.asc&limit=1`,
    ),
    {
      headers: restHeaders(config),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    const error = await readRestError(response)

    if (
      isMissingExternalIdColumn(error) ||
      isMissingSourceChannelColumn(error)
    ) {
      return null
    }

    return null
  }

  const rows = (await response.json()) as Array<{ visitor_uuid?: string }>
  return rows[0]?.visitor_uuid ?? null
}

export async function linkParticipantToUser(input: {
  participant_uuid: string
  user_uuid: string
}) {
  const config = requireConfig()

  const response = await fetch(
    restUrl(
      config,
      "participants",
      `participant_uuid=eq.${encodeURIComponent(input.participant_uuid)}&select=*`,
    ),
    {
      method: "PATCH",
      headers: {
        ...restHeaders(config),
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        user_uuid: input.user_uuid,
        role: "user",
      }),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    const error = await readRestError(response)
    throw new Error(`Failed to link participant to user: ${error.message ?? "unknown"}`)
  }

  const rows = (await response.json()) as ChatParticipantRecord[]
  return rows[0]
}

export async function updateRoomChannel(input: {
  room_uuid: string
  channel: ChatRoomRecord["channel"]
}) {
  const config = requireConfig()

  const response = await fetch(
    restUrl(config, "rooms", `room_uuid=eq.${encodeURIComponent(input.room_uuid)}&select=*`),
    {
      method: "PATCH",
      headers: {
        ...restHeaders(config),
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        channel: input.channel,
        updated_at: new Date().toISOString(),
      }),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    const error = await readRestError(response)
    throw new Error(`Failed to update room channel: ${error.message ?? "unknown"}`)
  }

  const rows = (await response.json()) as ChatRoomRecord[]
  return rows[0]
}

export async function updateRoomLocale(input: {
  room_uuid: string
  locale: ChatLocale
}) {
  const config = requireConfig()

  const response = await fetch(
    restUrl(config, "rooms", `room_uuid=eq.${encodeURIComponent(input.room_uuid)}&select=*`),
    {
      method: "PATCH",
      headers: {
        ...restHeaders(config),
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        locale: input.locale,
        updated_at: new Date().toISOString(),
      }),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    const error = await readRestError(response)
    throw new Error(`Failed to update room locale: ${error.message ?? "unknown"}`)
  }

  const rows = (await response.json()) as ChatRoomRecord[]
  return rows[0]
}

export async function insertRoom(input: {
  mode: ChatRoomMode
  locale: ChatLocale
  channel: ChatRoomRecord["channel"]
  room_key?: string | null
  user_uuid?: string | null
  visitor_uuid?: string | null
  order_uuid?: string | null
}) {
  const config = requireConfig()

  const body: Record<string, unknown> = {
    mode: input.mode,
    locale: input.locale,
    channel: input.channel,
  }

  if (input.room_key) {
    body.room_key = input.room_key
  }

  if (input.user_uuid) {
    body.user_uuid = input.user_uuid
  }

  if (input.visitor_uuid) {
    body.visitor_uuid = input.visitor_uuid
  }

  if (input.order_uuid) {
    body.order_uuid = input.order_uuid
  }

  const response = await fetch(restUrl(config, "rooms", "select=*"), {
    method: "POST",
    headers: {
      ...restHeaders(config),
      Prefer: "return=representation",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  })

  if (!response.ok) {
    const error = await readRestError(response)

    if (isMissingRoomIdentityColumn(error)) {
      return insertRoom({
        mode: input.mode,
        locale: input.locale,
        channel: input.channel,
        room_key: input.room_key,
      })
    }

    if (isMissingRoomKeyColumn(error)) {
      return insertRoom({
        mode: input.mode,
        locale: input.locale,
        channel: input.channel,
        user_uuid: input.user_uuid,
        visitor_uuid: input.visitor_uuid,
        order_uuid: input.order_uuid,
      })
    }

    throw new Error(`Failed to create room: ${error.message ?? "unknown"}`)
  }

  const rows = (await response.json()) as ChatRoomRecord[]
  return rows[0]
}

export async function findRoomByKey(room_key: string) {
  const config = getRestConfig()

  if (!config) {
    return null
  }

  const response = await fetch(
    restUrl(
      config,
      "rooms",
      `room_key=eq.${encodeURIComponent(room_key)}&select=*&limit=1`,
    ),
    {
      headers: restHeaders(config),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    const error = await readRestError(response)

    if (isMissingRoomKeyColumn(error)) {
      return null
    }

    return null
  }

  const rows = (await response.json()) as ChatRoomRecord[]
  return rows[0] ?? null
}

export async function upsertRoomByKey(input: {
  room_key: string
  mode: ChatRoomMode
  locale: ChatLocale
  user_uuid?: string | null
  visitor_uuid?: string | null
  order_uuid?: string | null
}) {
  const config = requireConfig()
  const body: Record<string, unknown> = {
    room_key: input.room_key,
    mode: input.mode,
    locale: input.locale,
  }

  if (input.user_uuid) {
    body.user_uuid = input.user_uuid
  }

  if (input.visitor_uuid) {
    body.visitor_uuid = input.visitor_uuid
  }

  if (input.order_uuid) {
    body.order_uuid = input.order_uuid
  }

  const response = await fetch(
    restUrl(config, "rooms", "on_conflict=room_key&select=*"),
    {
      method: "POST",
      headers: {
        ...restHeaders(config),
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    const error = await readRestError(response)

    throw new Error(`Failed to upsert room: ${error.message ?? "unknown"}`)
  }

  const rows = (await response.json()) as ChatRoomRecord[]
  return rows[0]
}

export async function findOrderRoomByUuid(order_uuid: string) {
  const { resolve_room_key } = await import("@/core/chat/rules")
  return findRoomByKey(resolve_room_key({ order_uuid }))
}

export async function findPersonalRoomByUserUuid(user_uuid: string) {
  const config = getRestConfig()

  if (!config) {
    return null
  }

  const response = await fetch(
    restUrl(
      config,
      "rooms",
      [
        `user_uuid=eq.${encodeURIComponent(user_uuid)}`,
        "order_uuid=is.null",
        "select=*",
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

  const rows = (await response.json()) as ChatRoomRecord[]
  return rows[0] ?? null
}

export async function findPersonalRoomByVisitorUuid(visitor_uuid: string) {
  const config = getRestConfig()

  if (!config) {
    return null
  }

  const response = await fetch(
    restUrl(
      config,
      "rooms",
      [
        `visitor_uuid=eq.${encodeURIComponent(visitor_uuid)}`,
        "user_uuid=is.null",
        "order_uuid=is.null",
        "select=*",
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

  const rows = (await response.json()) as ChatRoomRecord[]
  return rows[0] ?? null
}

export async function updateRoomMode(input: {
  room_uuid: string
  mode: ChatRoomMode
}) {
  const config = requireConfig()

  const response = await fetch(
    restUrl(config, "rooms", `room_uuid=eq.${encodeURIComponent(input.room_uuid)}&select=*`),
    {
      method: "PATCH",
      headers: {
        ...restHeaders(config),
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        mode: input.mode,
        updated_at: new Date().toISOString(),
      }),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    const error = await readRestError(response)
    throw new Error(`Failed to update room mode: ${error.message ?? "unknown"}`)
  }

  const rows = (await response.json()) as ChatRoomRecord[]
  return rows[0]
}

export async function updateRoomThreadState(input: {
  room_uuid: string
  thread_id?: string | null
  thread_status: "open" | "closed"
}) {
  const config = requireConfig()
  const body: {
    thread_id?: string | null
    thread_status: "open" | "closed"
    updated_at: string
  } = {
    thread_status: input.thread_status,
    updated_at: new Date().toISOString(),
  }

  if (input.thread_id !== undefined) {
    body.thread_id = input.thread_id
  }

  console.log({
    event: "odin_room_update_entered",
    room_uuid: input.room_uuid,
    thread_id: input.thread_id ?? null,
    thread_status: input.thread_status,
    http_status: null,
    error_message: null,
  })

  const response = await fetch(
    restUrl(config, "rooms", `room_uuid=eq.${encodeURIComponent(input.room_uuid)}&select=*`),
    {
      method: "PATCH",
      headers: {
        ...restHeaders(config),
        Prefer: "return=representation",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    const error = await readRestError(response)
    console.warn({
      event: "odin_room_update_failed",
      room_uuid: input.room_uuid,
      thread_id: input.thread_id ?? null,
      thread_status: input.thread_status,
      http_status: response.status,
      error_message: error.message ?? "unknown",
    })
    console.warn({
      event: "room_thread_save_failed",
      room_uuid: input.room_uuid,
      thread_id: input.thread_id ?? null,
      thread_status: input.thread_status,
      http_status: response.status,
      error_message: error.message ?? "unknown",
    })
    throw new Error(
      `Failed to update room thread state: ${error.message ?? "unknown"}`,
    )
  }

  const rows = (await response.json()) as ChatRoomRecord[]
  const room = rows[0]

  console.log({
    event: "odin_room_update_response",
    room_uuid: input.room_uuid,
    thread_id: room?.thread_id ?? input.thread_id ?? null,
    thread_status: room?.thread_status ?? input.thread_status,
    http_status: response.status,
    error_message: null,
  })
  console.log({
    event: "room_thread_saved",
    room_uuid: input.room_uuid,
    thread_id: room?.thread_id ?? input.thread_id ?? null,
    thread_status: room?.thread_status ?? input.thread_status,
    http_status: response.status,
    error_message: null,
  })

  return rows[0]
}

export async function findRoomByUuid(room_uuid: string) {
  const config = getRestConfig()

  if (!config) {
    return null
  }

  const response = await fetch(
    restUrl(
      config,
      "rooms",
      `room_uuid=eq.${encodeURIComponent(room_uuid)}&select=*&limit=1`,
    ),
    {
      headers: restHeaders(config),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    return null
  }

  const rows = (await response.json()) as ChatRoomRecord[]
  return rows[0] ?? null
}

export async function findParticipant(input: {
  room_uuid: string
  visitor_uuid: string | null
  user_uuid: string | null
}) {
  const config = getRestConfig()

  if (!config) {
    return null
  }

  const filter = input.user_uuid
    ? `room_uuid=eq.${encodeURIComponent(input.room_uuid)}&user_uuid=eq.${encodeURIComponent(input.user_uuid)}`
    : input.visitor_uuid
      ? `room_uuid=eq.${encodeURIComponent(input.room_uuid)}&visitor_uuid=eq.${encodeURIComponent(input.visitor_uuid)}`
      : null

  if (!filter) {
    return null
  }

  const response = await fetch(
    restUrl(config, "participants", `${filter}&select=*&limit=1`),
    {
      headers: restHeaders(config),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    return null
  }

  const rows = (await response.json()) as ChatParticipantRecord[]
  return rows[0] ?? null
}

export async function loadRoomParticipants(room_uuid: string) {
  const config = getRestConfig()

  if (!config) {
    return []
  }

  const response = await fetch(
    restUrl(
      config,
      "participants",
      `room_uuid=eq.${encodeURIComponent(room_uuid)}&select=*&order=joined_at.asc`,
    ),
    {
      headers: restHeaders(config),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    return []
  }

  return (await response.json()) as ChatParticipantRecord[]
}

export async function findParticipantByRole(input: {
  room_uuid: string
  role: ChatParticipantRole
}) {
  const config = getRestConfig()

  if (!config) {
    return null
  }

  const response = await fetch(
    restUrl(
      config,
      "participants",
      [
        `room_uuid=eq.${encodeURIComponent(input.room_uuid)}`,
        `role=eq.${encodeURIComponent(input.role)}`,
        "select=*",
        "order=joined_at.asc",
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

  const rows = (await response.json()) as ChatParticipantRecord[]
  return rows[0] ?? null
}

export async function insertParticipant(input: {
  room_uuid: string
  role: ChatParticipantRole
  visitor_uuid: string | null
  user_uuid: string | null
}) {
  const config = requireConfig()

  const response = await fetch(
    restUrl(config, "participants", "select=*"),
    {
      method: "POST",
      headers: {
        ...restHeaders(config),
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        room_uuid: input.room_uuid,
        role: input.role,
        visitor_uuid: input.visitor_uuid,
        user_uuid: input.user_uuid,
        joined_at: new Date().toISOString(),
      }),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    const error = await readRestError(response)
    throw new Error(
      `Failed to create participant: ${error.code ?? "unknown"} ${
        error.message ?? "unknown"
      } ${error.details ?? ""} ${error.hint ?? ""}`.trim(),
    )
  }

  const rows = (await response.json()) as ChatParticipantRecord[]
  return rows[0]
}

export async function upsertParticipant(input: {
  room_uuid: string
  role: ChatParticipantRole
  visitor_uuid: string | null
  user_uuid: string | null
}) {
  const existing = await findOwnerParticipantInRoom({
    room_uuid: input.room_uuid,
    user_uuid: input.user_uuid,
    visitor_uuid: input.visitor_uuid,
    role: input.role,
  })

  if (existing) {
    return existing
  }

  try {
    return await insertParticipant(input)
  } catch {
    const recovered = await findOwnerParticipantInRoom({
      room_uuid: input.room_uuid,
      user_uuid: input.user_uuid,
      visitor_uuid: input.visitor_uuid,
      role: input.role,
    })

    if (recovered) {
      return recovered
    }

    throw new Error("Failed to upsert participant")
  }
}

export async function findMessageByExternalId(input: {
  source_channel: string
  external_id: string
}) {
  const config = getRestConfig()

  if (!config) {
    return null
  }

  const response = await fetch(
    restUrl(
      config,
      "messages",
      [
        `source_channel=eq.${encodeURIComponent(input.source_channel)}`,
        `external_id=eq.${encodeURIComponent(input.external_id)}`,
        "select=*",
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

  const rows = (await response.json()) as ChatMessageRecord[]
  return rows[0] ?? null
}

function isMissingMessageKindColumn(error: {
  code?: string | null
  message?: string | null
}) {
  return (
    error.code === "PGRST204" &&
    error.message?.includes("'message_kind' column") === true
  )
}

function isMissingExternalIdColumn(error: {
  code?: string | null
  message?: string | null
}) {
  return (
    error.code === "PGRST204" &&
    error.message?.includes("'external_id' column") === true
  )
}

function isMissingSourceChannelColumn(error: {
  code?: string | null
  message?: string | null
}) {
  return (
    error.code === "PGRST204" &&
    error.message?.includes("'source_channel' column") === true
  )
}

async function findLegacyWelcomeMessage(room_uuid: string) {
  const config = getRestConfig()

  if (!config) {
    return null
  }

  const response = await fetch(
    restUrl(
      config,
      "messages",
      [
        `room_uuid=eq.${encodeURIComponent(room_uuid)}`,
        "body=eq.welcome",
        "type=eq.flex",
        "select=*",
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

  const rows = (await response.json()) as ChatMessageRecord[]
  return rows[0] ?? null
}

async function findFlexWelcomeMessage(room_uuid: string) {
  return findLegacyWelcomeMessage(room_uuid)
}

export { findFlexWelcomeMessage }

export async function findWelcomeMessage(room_uuid: string) {
  const config = getRestConfig()

  if (!config) {
    return null
  }

  const response = await fetch(
    restUrl(
      config,
      "messages",
      [
        `room_uuid=eq.${encodeURIComponent(room_uuid)}`,
        "message_kind=eq.welcome",
        "select=*",
        "limit=1",
      ].join("&"),
    ),
    {
      headers: restHeaders(config),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    const error = await readRestError(response)

    if (isMissingMessageKindColumn(error)) {
      return findLegacyWelcomeMessage(room_uuid)
    }

    return null
  }

  const rows = (await response.json()) as ChatMessageRecord[]
  return rows[0] ?? null
}

export async function archiveWelcomeMessage(input: {
  room_uuid: string
  type: ChatMessageType
  body: string
  payload: Record<string, unknown> | null
  source_channel?: string | null
}) {
  const existing = await findFlexWelcomeMessage(input.room_uuid)

  if (existing) {
    return existing
  }

  const { ensureRoleParticipant } = await import("@/core/chat/participant")
  const bot = await ensureRoleParticipant({
    room_uuid: input.room_uuid,
    role: "bot",
  })

  try {
    return await insertMessage({
      room_uuid: input.room_uuid,
      participant_uuid: bot.participant_uuid,
      message_kind: "welcome",
      type: input.type,
      status: "sent",
      body: input.body,
      payload: input.payload,
      source_channel: input.source_channel ?? null,
    })
  } catch (error) {
    const duplicate = await findFlexWelcomeMessage(input.room_uuid)

    if (duplicate) {
      return duplicate
    }

    throw error
  }
}

export async function insertMessage(input: {
  message_uuid?: string
  room_uuid: string
  participant_uuid: string
  message_kind?: string | null
  type: ChatMessageType
  status?: ChatMessageStatus
  body: string
  payload: Record<string, unknown> | null
  source_channel?: string | null
  external_id?: string | null
}) {
  const config = requireConfig()
  const body: Record<string, unknown> = {
    ...input,
    status: input.status ?? "sent",
  }
  delete body.message_kind
  delete body.external_id
  delete body.source_channel

  if (input.message_kind) {
    body.message_kind = input.message_kind
  }

  if (input.source_channel) {
    body.source_channel = input.source_channel
  }

  if (input.external_id) {
    body.external_id = input.external_id
  }

  const response = await fetch(restUrl(config, "messages", "select=*"), {
    method: "POST",
    headers: {
      ...restHeaders(config),
      Prefer: "return=representation",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  })

  if (!response.ok) {
    const error = await readRestError(response)

    if (input.message_kind && isMissingMessageKindColumn(error)) {
      return insertMessage({
        ...input,
        message_kind: null,
      })
    }

    if (input.external_id && isMissingExternalIdColumn(error)) {
      return insertMessage({
        ...input,
        external_id: null,
      })
    }

    if (input.source_channel && isMissingSourceChannelColumn(error)) {
      return insertMessage({
        ...input,
        source_channel: null,
        external_id: null,
      })
    }

    if (
      error.code === "23505" &&
      input.source_channel &&
      input.external_id
    ) {
      const existing = await findMessageByExternalId({
        source_channel: input.source_channel,
        external_id: input.external_id,
      })

      if (existing) {
        return existing
      }
    }

    if (error.code === "23505" && input.message_kind === "welcome") {
      const existing = await findFlexWelcomeMessage(input.room_uuid)

      if (existing) {
        return existing
      }
    }

    await sendAuthDebug("chat_archive_failed", {
      room_uuid: input.room_uuid,
      participant_uuid: input.participant_uuid,
      type: input.type,
      body: input.body,
      message_kind: input.message_kind ?? null,
      source_channel: input.source_channel ?? null,
      external_id: input.external_id ?? null,
      error_code: error.code ?? null,
      error_message: error.message ?? "unknown",
    })

    throw new Error(
      `Failed to archive message: ${error.code ?? "unknown"} ${
        error.message ?? "unknown"
      } ${error.details ?? ""} ${error.hint ?? ""}`.trim(),
    )
  }

  const rows = (await response.json()) as ChatMessageRecord[]
  return rows[0]
}

export async function loadRoomMessages(room_uuid: string, limit = 50) {
  const config = getRestConfig()

  if (!config) {
    return []
  }

  const response = await fetch(
    restUrl(
      config,
      "messages",
      `room_uuid=eq.${encodeURIComponent(room_uuid)}&select=*&order=created_at.asc&limit=${limit}`,
    ),
    {
      headers: restHeaders(config),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    return []
  }

  return (await response.json()) as ChatMessageRecord[]
}

export async function countRoomMessages(room_uuid: string) {
  const config = getRestConfig()

  if (!config) {
    return 0
  }

  const response = await fetch(
    restUrl(
      config,
      "messages",
      `room_uuid=eq.${encodeURIComponent(room_uuid)}&select=message_uuid`,
    ),
    {
      headers: {
        ...restHeaders(config),
        Prefer: "count=exact",
      },
      cache: "no-store",
    },
  )

  if (!response.ok) {
    return 0
  }

  const range = response.headers.get("content-range")
  const total = range?.split("/")[1]

  if (total && Number.isFinite(Number(total))) {
    return Number(total)
  }

  const rows = (await response.json()) as Array<{ message_uuid: string }>
  return rows.length
}

export async function roomHasWelcomeMessage(room_uuid: string) {
  const config = getRestConfig()

  if (!config) {
    return false
  }

  const response = await fetch(
    restUrl(
      config,
      "messages",
      [
        `room_uuid=eq.${encodeURIComponent(room_uuid)}`,
        "or=(message_kind.eq.welcome,and(body.eq.welcome,type.eq.flex))",
        "select=message_uuid",
        "limit=1",
      ].join("&"),
    ),
    {
      headers: restHeaders(config),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    const error = await readRestError(response)

    if (isMissingMessageKindColumn(error)) {
      return Boolean(await findLegacyWelcomeMessage(room_uuid))
    }

    return false
  }

  const rows = (await response.json()) as Array<{ message_uuid: string }>
  return rows.length > 0
}

export async function loadUserDisplayNames(user_uuids: string[]) {
  const config = getRestConfig()

  if (!config || user_uuids.length === 0) {
    return new Map<string, string>()
  }

  const response = await fetch(
    restUrl(
      config,
      "users",
      `user_uuid=in.(${user_uuids.map((uuid) => encodeURIComponent(uuid)).join(",")})&select=user_uuid,display_name`,
    ),
    {
      headers: restHeaders(config),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    return new Map<string, string>()
  }

  const rows = (await response.json()) as Array<{
    user_uuid: string
    display_name: string | null
  }>

  return new Map(
    rows.map((row) => [row.user_uuid, row.display_name?.trim() || row.user_uuid]),
  )
}

export async function loadUserProfiles(user_uuids: string[]) {
  const config = getRestConfig()

  if (!config || user_uuids.length === 0) {
    return new Map<
      string,
      { display_name: string | null; image_url: string | null }
    >()
  }

  const response = await fetch(
    restUrl(
      config,
      "users",
      `user_uuid=in.(${user_uuids.map((uuid) => encodeURIComponent(uuid)).join(",")})&select=user_uuid,display_name,image_url`,
    ),
    {
      headers: restHeaders(config),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    return new Map()
  }

  const rows = (await response.json()) as Array<{
    user_uuid: string
    display_name: string | null
    image_url: string | null
  }>

  return new Map(
    rows.map((row) => [
      row.user_uuid,
      {
        display_name: row.display_name?.trim() || null,
        image_url: row.image_url?.trim() || null,
      },
    ]),
  )
}

export async function loadConciergeQueueRooms(
  limit = 10,
  condition: { mode: "concierge" } = { mode: "concierge" },
) {
  const config = getRestConfig()

  if (!config) {
    return []
  }

  const response = await fetch(
    restUrl(
      config,
      "rooms",
      [
        `mode=eq.${encodeURIComponent(condition.mode)}`,
        "select=*",
        "order=updated_at.desc",
        `limit=${limit}`,
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

  return (await response.json()) as ChatRoomRecord[]
}

export async function loadLatestRoomMessages(room_uuids: string[]) {
  const entries = await Promise.all(
    room_uuids.map(async (room_uuid) => {
      const message = await loadLatestRoomMessage(room_uuid)
      return [room_uuid, message] as const
    }),
  )

  return new Map(entries)
}

export async function loadLatestRoomMessage(room_uuid: string) {
  const config = getRestConfig()

  if (!config) {
    return null
  }

  const response = await fetch(
    restUrl(
      config,
      "messages",
      [
        `room_uuid=eq.${encodeURIComponent(room_uuid)}`,
        "type=neq.typing",
        "select=*",
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

  const rows = (await response.json()) as ChatMessageRecord[]
  return rows[0] ?? null
}
