import { getRestConfig, readRestError, restHeaders, restUrl } from "@/core/db/rest"
import type {
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

export async function loadConciergeAvailability() {
  const config = getRestConfig()

  if (!config) {
    return true
  }

  const response = await fetch(
    restUrl(config, "concierge_availability", "id=eq.1&select=available"),
    {
      headers: restHeaders(config),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    return true
  }

  const rows = (await response.json()) as Array<{ available?: boolean }>
  return rows[0]?.available ?? true
}

export async function setConciergeAvailability(input: {
  available: boolean
  updated_by: string | null
}) {
  const config = requireConfig()

  const response = await fetch(
    restUrl(config, "concierge_availability", "id=eq.1"),
    {
      method: "PATCH",
      headers: restHeaders(config),
      body: JSON.stringify({
        available: input.available,
        updated_by: input.updated_by,
        updated_at: new Date().toISOString(),
      }),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    const error = await readRestError(response)
    throw new Error(
      `Failed to update concierge availability: ${error.message ?? "unknown"}`,
    )
  }

  return { available: input.available }
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
    [
      `visitor_uuid=eq.${encodeURIComponent(visitor_uuid)}`,
      "user_uuid=is.null",
      "role=eq.guest",
    ].join("&"),
  )
}

export async function findOwnerParticipantInRoom(input: {
  room_uuid: string
  user_uuid: string | null
  visitor_uuid: string | null
}) {
  if (input.user_uuid) {
    const by_user = await findParticipantRow(
      `room_uuid=eq.${encodeURIComponent(input.room_uuid)}&user_uuid=eq.${encodeURIComponent(input.user_uuid)}`,
    )

    if (by_user) {
      return by_user
    }
  }

  if (input.visitor_uuid) {
    return findParticipantRow(
      `room_uuid=eq.${encodeURIComponent(input.room_uuid)}&visitor_uuid=eq.${encodeURIComponent(input.visitor_uuid)}`,
    )
  }

  return null
}

export type ResolvedOwnerParticipant = {
  room: ChatRoomRecord
  participant: ChatParticipantRecord
  found_by: "user_uuid" | "visitor_uuid"
}

export async function resolveRoomFromParticipants(input: {
  visitor_uuid: string | null
  user_uuid: string | null
  mode?: ChatRoomMode
}): Promise<ResolvedOwnerParticipant | null> {
  void input.mode

  let participant: ChatParticipantRecord | null = null
  let found_by: ResolvedOwnerParticipant["found_by"] | null = null

  if (input.user_uuid) {
    participant = await findOldestParticipantByUserUuid(input.user_uuid)

    if (participant) {
      found_by = "user_uuid"
    }
  }

  if (!participant && input.visitor_uuid) {
    participant = await findOldestParticipantByVisitorUuid(input.visitor_uuid)

    if (participant) {
      found_by = "visitor_uuid"
    }

    if (participant && input.user_uuid) {
      try {
        participant = await linkParticipantToUser({
          participant_uuid: participant.participant_uuid,
          user_uuid: input.user_uuid,
        })
        found_by = "user_uuid"
      } catch {
        const linked = await findOldestParticipantByUserUuid(input.user_uuid)

        if (linked) {
          participant = linked
          found_by = "user_uuid"
        }
      }
    }
  }

  if (!participant || !found_by) {
    return null
  }

  const room = await findRoomByUuid(participant.room_uuid)

  if (!room) {
    return null
  }

  return { room, participant, found_by }
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
}) {
  const config = requireConfig()

  const response = await fetch(restUrl(config, "rooms", "select=*"), {
    method: "POST",
    headers: {
      ...restHeaders(config),
      Prefer: "return=representation",
    },
    body: JSON.stringify(input),
    cache: "no-store",
  })

  if (!response.ok) {
    const error = await readRestError(response)
    throw new Error(`Failed to create room: ${error.message ?? "unknown"}`)
  }

  const rows = (await response.json()) as ChatRoomRecord[]
  return rows[0]
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
    throw new Error(`Failed to create participant: ${error.message ?? "unknown"}`)
  }

  const rows = (await response.json()) as ChatParticipantRecord[]
  return rows[0]
}

export async function insertMessage(input: {
  message_uuid?: string
  room_uuid: string
  participant_uuid: string | null
  type: ChatMessageType
  status?: ChatMessageStatus
  body: string
  payload: Record<string, unknown> | null
}) {
  const config = requireConfig()

  const response = await fetch(restUrl(config, "messages", "select=*"), {
    method: "POST",
    headers: {
      ...restHeaders(config),
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      ...input,
      status: input.status ?? "sent",
    }),
    cache: "no-store",
  })

  if (!response.ok) {
    const error = await readRestError(response)
    throw new Error(`Failed to archive message: ${error.message ?? "unknown"}`)
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
        "body=eq.welcome",
        "type=eq.flex",
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
