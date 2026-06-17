import { getRestConfig, readRestError, restHeaders, restUrl } from "@/core/db/rest"
import type {
  ChatLocale,
  ChatMessageKind,
  ChatMessageRecord,
  ChatMessageType,
  ChatParticipantRecord,
  ChatRoomMode,
  ChatRoomRecord,
  ChatTranslations,
  ChatTypingRecord,
  TranslationStatus,
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

export async function findRoomForOwner(input: {
  visitor_uuid: string | null
  user_uuid: string | null
}) {
  const config = getRestConfig()

  if (!config) {
    return null
  }

  if (input.user_uuid) {
    const by_user = await fetchRoomByFilter(
      config,
      `owner_user_uuid=eq.${encodeURIComponent(input.user_uuid)}`,
    )

    if (by_user) {
      return by_user
    }
  }

  if (input.visitor_uuid) {
    const by_visitor = await fetchRoomByFilter(
      config,
      `owner_visitor_uuid=eq.${encodeURIComponent(input.visitor_uuid)}`,
    )

    if (by_visitor) {
      if (input.user_uuid && !by_visitor.owner_user_uuid) {
        return linkRoomToUser(by_visitor.room_uuid, input.user_uuid)
      }

      return by_visitor
    }
  }

  return null
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

async function fetchRoomByFilter(
  config: NonNullable<ReturnType<typeof getRestConfig>>,
  filter: string,
) {
  const response = await fetch(
    restUrl(config, "rooms", `${filter}&select=*&order=created_at.asc&limit=1`),
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

export async function linkRoomToUser(room_uuid: string, user_uuid: string) {
  const config = requireConfig()

  const response = await fetch(
    restUrl(config, "rooms", `room_uuid=eq.${encodeURIComponent(room_uuid)}&select=*`),
    {
      method: "PATCH",
      headers: {
        ...restHeaders(config),
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        owner_user_uuid: user_uuid,
        updated_at: new Date().toISOString(),
      }),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    const error = await readRestError(response)
    throw new Error(`Failed to link room to user: ${error.message ?? "unknown"}`)
  }

  const rows = (await response.json()) as ChatRoomRecord[]
  return rows[0]
}

export async function updateRoomChannel(input: {
  room_uuid: string
  channel: ChatRoomRecord["channel"]
  user_uuid?: string | null
}) {
  const config = requireConfig()

  const patch: Record<string, unknown> = {
    channel: input.channel,
    updated_at: new Date().toISOString(),
  }

  if (input.user_uuid) {
    patch.owner_user_uuid = input.user_uuid
  }

  const response = await fetch(
    restUrl(config, "rooms", `room_uuid=eq.${encodeURIComponent(input.room_uuid)}&select=*`),
    {
      method: "PATCH",
      headers: {
        ...restHeaders(config),
        Prefer: "return=representation",
      },
      body: JSON.stringify(patch),
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

export async function insertRoom(input: {
  mode: ChatRoomMode
  locale: ChatLocale
  channel: ChatRoomRecord["channel"]
  owner_visitor_uuid: string | null
  owner_user_uuid: string | null
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

  if (response.status === 409) {
    const existing = await findRoomForOwner({
      visitor_uuid: input.owner_visitor_uuid,
      user_uuid: input.owner_user_uuid,
    })

    if (existing) {
      return existing
    }
  }

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
    restUrl(config, "room_participants", `${filter}&select=*&limit=1`),
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
  role: ChatParticipantRecord["role"]
  visitor_uuid: string | null
  user_uuid: string | null
  display_name: string | null
}) {
  const config = requireConfig()

  const response = await fetch(
    restUrl(config, "room_participants", "select=*"),
    {
      method: "POST",
      headers: {
        ...restHeaders(config),
        Prefer: "return=representation",
      },
      body: JSON.stringify(input),
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
  source_channel: ChatMessageRecord["source_channel"]
  kind: ChatMessageKind
  type: ChatMessageType
  body_original: string
  original_locale: ChatLocale
  body_display: string
  display_locale: ChatLocale
  translations: ChatTranslations
  translation_status: TranslationStatus
  payload: Record<string, unknown> | null
}) {
  const config = requireConfig()

  const response = await fetch(restUrl(config, "messages", "select=*"), {
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

export async function upsertTypingState(input: {
  room_uuid: string
  participant_uuid: string
  display_name: string
  locale: ChatLocale
}) {
  const config = requireConfig()

  const response = await fetch(
    restUrl(config, "room_typing_states", "on_conflict=room_uuid,participant_uuid"),
    {
      method: "POST",
      headers: {
        ...restHeaders(config),
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({
        ...input,
        updated_at: new Date().toISOString(),
      }),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    const error = await readRestError(response)
    throw new Error(`Failed to update typing state: ${error.message ?? "unknown"}`)
  }
}

export async function clearTypingState(input: {
  room_uuid: string
  participant_uuid: string
}) {
  const config = getRestConfig()

  if (!config) {
    return
  }

  await fetch(
    restUrl(
      config,
      "room_typing_states",
      `room_uuid=eq.${encodeURIComponent(input.room_uuid)}&participant_uuid=eq.${encodeURIComponent(input.participant_uuid)}`,
    ),
    {
      method: "DELETE",
      headers: restHeaders(config),
      cache: "no-store",
    },
  )
}

export async function clearStaleTypingStates(
  room_uuid: string,
  cutoff_iso: string,
) {
  const config = getRestConfig()

  if (!config) {
    return
  }

  await fetch(
    restUrl(
      config,
      "room_typing_states",
      `room_uuid=eq.${encodeURIComponent(room_uuid)}&updated_at=lt.${encodeURIComponent(cutoff_iso)}`,
    ),
    {
      method: "DELETE",
      headers: restHeaders(config),
      cache: "no-store",
    },
  )
}

export async function loadTypingStates(room_uuid: string) {
  const config = getRestConfig()

  if (!config) {
    return []
  }

  const response = await fetch(
    restUrl(
      config,
      "room_typing_states",
      `room_uuid=eq.${encodeURIComponent(room_uuid)}&select=*&order=updated_at.desc`,
    ),
    {
      headers: restHeaders(config),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    return []
  }

  return (await response.json()) as ChatTypingRecord[]
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
