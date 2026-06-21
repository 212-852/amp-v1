import { getRestConfig, readRestError, restHeaders, restUrl } from "@/core/db/rest"
import { sendAuthDebug } from "@/core/debug"
import { get_display_name } from "@/core/profile/display"
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
    return false
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

export async function loadEnabledAvailabilityRecipients(): Promise<
  Array<Pick<AvailabilityRecord, "user_uuid">>
> {
  const config = getRestConfig()

  if (!config) {
    return []
  }

  const response = await fetch(
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

  if (!response.ok) {
    return []
  }

  return (await response.json()) as Array<Pick<AvailabilityRecord, "user_uuid">>
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

function readArchiveClientMessageId(
  payload: Record<string, unknown> | null | undefined,
) {
  const meta = payload?.meta

  if (!meta || typeof meta !== "object" || Array.isArray(meta)) {
    return null
  }

  const client_message_id = (meta as Record<string, unknown>).client_message_id

  return typeof client_message_id === "string" && client_message_id.trim()
    ? client_message_id.trim()
    : null
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

  const archive_debug = {
    room_uuid: input.room_uuid,
    message_uuid: input.message_uuid ?? null,
    client_message_id: readArchiveClientMessageId(input.payload),
    sender_uuid: input.participant_uuid,
    body_length: input.body.length,
  }

  await sendAuthDebug("chat_archive_insert_start", archive_debug)

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

    await sendAuthDebug("chat_archive_insert_error", {
      ...archive_debug,
      error_code: error.code ?? null,
      error_message: error.message ?? "unknown",
    })

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
  const message = rows[0]

  if (message) {
    await sendAuthDebug("chat_archive_insert_success", {
      room_uuid: message.room_uuid,
      message_uuid: message.message_uuid,
      client_message_id: readArchiveClientMessageId(
        message.payload as Record<string, unknown> | null,
      ),
      sender_uuid: message.participant_uuid,
      body_length: message.body?.length ?? input.body.length,
    })

    await touchRoomUpdatedAt(input.room_uuid).catch((error) => {
      console.warn("[chat_core] room_touch_failed", {
        room_uuid: input.room_uuid,
        message_uuid: message.message_uuid,
        error_message: error instanceof Error ? error.message : String(error),
      })
    })
  }

  return message
}

async function touchRoomUpdatedAt(room_uuid: string) {
  const config = getRestConfig()

  if (!config) {
    return
  }

  await fetch(
    restUrl(config, "rooms", `room_uuid=eq.${encodeURIComponent(room_uuid)}`),
    {
      method: "PATCH",
      headers: {
        ...restHeaders(config),
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        updated_at: new Date().toISOString(),
      }),
      cache: "no-store",
    },
  )
}

export async function loadRoomMessages(
  room_uuid: string,
  limit = 30,
  before?: string | null,
) {
  const config = getRestConfig()

  if (!config) {
    return []
  }

  const response = await fetch(
    restUrl(
      config,
      "messages",
      [
        `room_uuid=eq.${encodeURIComponent(room_uuid)}`,
        before ? `created_at=lt.${encodeURIComponent(before)}` : null,
        "select=*",
        "order=created_at.desc",
        `limit=${Math.min(Math.max(limit, 1), 50)}`,
      ]
        .filter(Boolean)
        .join("&"),
    ),
    {
      headers: restHeaders(config),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    const error = await readRestError(response)
    const error_payload = {
      room_uuid,
      status: response.status,
      code: error.code ?? null,
      message: error.message ?? null,
      details: error.details ?? null,
      hint: error.hint ?? null,
    }

    console.error("[chat] message initial fetch error", error_payload)
    await sendAuthDebug("message_initial_fetch_error", error_payload)
    await sendAuthDebug("user_chat_initial_fetch_error", error_payload)

    return []
  }

  return ((await response.json()) as ChatMessageRecord[]).reverse()
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

type AccountDisplayRow = {
  user_uuid: string
  name?: string | null
  display_name?: string | null
  image_url?: string | null
}

type ProfileDisplayRow = {
  user_uuid: string
  nickname: string | null
  first_name: string | null
  last_name: string | null
}

type LineIdentityRow = {
  user_uuid: string
}

function resolveArchiveDisplayName(input: {
  user_uuid: string
  profile?: ProfileDisplayRow | null
  account?: AccountDisplayRow | null
  line_linked?: boolean
}) {
  const line_name =
    input.line_linked
      ? input.account?.display_name?.trim() || null
      : null

  return get_display_name(
    {
      nickname: input.profile?.nickname,
    },
    {
      line_name,
      name: input.account?.name,
      fallback: input.user_uuid,
    },
  )
}

async function loadLineLinkedUserUuids(user_uuids: string[]) {
  const config = getRestConfig()

  if (!config || user_uuids.length === 0) {
    return new Set<string>()
  }

  const encoded_uuids = user_uuids.map((uuid) => encodeURIComponent(uuid)).join(",")
  const response = await fetch(
    restUrl(
      config,
      "identities",
      `user_uuid=in.(${encoded_uuids})&provider=eq.line&select=user_uuid`,
    ),
    {
      headers: restHeaders(config),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    return new Set<string>()
  }

  const rows = (await response.json()) as LineIdentityRow[]
  return new Set(rows.map((row) => row.user_uuid))
}

export async function resolveParticipantArchiveDisplayName(user_uuid: string) {
  const [accounts, profiles, line_linked_uuids] = await Promise.all([
    loadUserAccountDisplayRows([user_uuid]),
    loadProfileDisplayRows([user_uuid]),
    loadLineLinkedUserUuids([user_uuid]),
  ])

  return resolveArchiveDisplayName({
    user_uuid,
    profile: profiles.get(user_uuid),
    account: accounts.get(user_uuid),
    line_linked: line_linked_uuids.has(user_uuid),
  })
}

async function loadUserAccountDisplayRows(user_uuids: string[]) {
  const config = getRestConfig()

  if (!config || user_uuids.length === 0) {
    return new Map<string, AccountDisplayRow>()
  }

  const encoded_uuids = user_uuids.map((uuid) => encodeURIComponent(uuid)).join(",")
  const queries = [
    `user_uuid=in.(${encoded_uuids})&select=user_uuid,name,display_name,image_url`,
    `user_uuid=in.(${encoded_uuids})&select=user_uuid,name,image_url`,
    `user_uuid=in.(${encoded_uuids})&select=user_uuid,display_name,image_url`,
  ]

  const merged = new Map<string, AccountDisplayRow>()

  for (const query of queries) {
    const response = await fetch(restUrl(config, "users", query), {
      headers: restHeaders(config),
      cache: "no-store",
    })

    if (!response.ok) {
      continue
    }

    const rows = (await response.json()) as AccountDisplayRow[]

    for (const row of rows) {
      const existing = merged.get(row.user_uuid)

      merged.set(row.user_uuid, {
        user_uuid: row.user_uuid,
        name: row.name ?? existing?.name ?? null,
        display_name: row.display_name ?? existing?.display_name ?? null,
        image_url: row.image_url ?? existing?.image_url ?? null,
      })
    }

    if (merged.size > 0 && [...merged.values()].every(
      (row) => row.name || row.display_name,
    )) {
      break
    }
  }

  return merged
}

async function loadProfileDisplayRows(user_uuids: string[]) {
  const config = getRestConfig()

  if (!config || user_uuids.length === 0) {
    return new Map<string, ProfileDisplayRow>()
  }

  const response = await fetch(
    restUrl(
      config,
      "profiles",
      `user_uuid=in.(${user_uuids.map((uuid) => encodeURIComponent(uuid)).join(",")})&select=user_uuid,nickname,first_name,last_name`,
    ),
    {
      headers: restHeaders(config),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    return new Map()
  }

  const rows = (await response.json()) as ProfileDisplayRow[]
  return new Map(rows.map((row) => [row.user_uuid, row]))
}

export async function loadUserDisplayNames(user_uuids: string[]) {
  if (user_uuids.length === 0) {
    return new Map<string, string>()
  }

  const [accounts, profiles, line_linked_uuids] = await Promise.all([
    loadUserAccountDisplayRows(user_uuids),
    loadProfileDisplayRows(user_uuids),
    loadLineLinkedUserUuids(user_uuids),
  ])

  return new Map(
    user_uuids.map((user_uuid) => [
      user_uuid,
      resolveArchiveDisplayName({
        user_uuid,
        profile: profiles.get(user_uuid),
        account: accounts.get(user_uuid),
        line_linked: line_linked_uuids.has(user_uuid),
      }),
    ]),
  )
}

export async function loadUserProfiles(user_uuids: string[]) {
  if (user_uuids.length === 0) {
    return new Map<
      string,
      { display_name: string | null; image_url: string | null }
    >()
  }

  const [accounts, profiles, line_linked_uuids] = await Promise.all([
    loadUserAccountDisplayRows(user_uuids),
    loadProfileDisplayRows(user_uuids),
    loadLineLinkedUserUuids(user_uuids),
  ])

  return new Map(
    user_uuids.map((user_uuid) => {
      const account = accounts.get(user_uuid)

      return [
        user_uuid,
        {
          display_name: resolveArchiveDisplayName({
            user_uuid,
            profile: profiles.get(user_uuid),
            account,
            line_linked: line_linked_uuids.has(user_uuid),
          }),
          image_url: account?.image_url?.trim() || null,
        },
      ]
    }),
  )
}

export async function loadConciergeQueueRooms(
  limit = 10,
  condition: { mode: "concierge" | "bot"; strict_concierge?: boolean } = { mode: "concierge" },
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
        condition.mode === "concierge"
          ? condition.strict_concierge
            ? "mode=eq.concierge"
            : "or=(mode.eq.concierge,thread_status.eq.open)"
          : "mode=eq.bot&or=(thread_status.neq.open,thread_status.is.null)",
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
