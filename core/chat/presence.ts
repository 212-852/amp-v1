import {
  loadRoomParticipants,
  loadUserDisplayNames,
} from "@/core/chat/archive"
import { getRestConfig, readRestError, restHeaders, restUrl } from "@/core/db/rest"
import type {
  ChatLocale,
  ChatParticipantRole,
  PresenceRecord,
  PresenceStatus,
  PresenceView,
} from "@/core/chat/types"

function requireConfig() {
  const config = getRestConfig()

  if (!config) {
    throw new Error("Database is unavailable")
  }

  return config
}

export function resolvePresenceJoinMessage(display_name: string) {
  return `${display_name} joined the room`
}

export function resolvePresenceLeaveMessage(display_name: string) {
  return `${display_name} left the room`
}

export async function upsertRoomPresenceEnter(input: {
  room_uuid: string
  participant_uuid: string
}) {
  const config = requireConfig()
  const now = new Date().toISOString()

  const response = await fetch(
    restUrl(config, "presence", "on_conflict=room_uuid,participant_uuid"),
    {
      method: "POST",
      headers: {
        ...restHeaders(config),
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify({
        room_uuid: input.room_uuid,
        participant_uuid: input.participant_uuid,
        status: "entered" satisfies PresenceStatus,
        entered_at: now,
        left_at: null,
        last_seen_at: now,
        updated_at: now,
      }),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    const error = await readRestError(response)
    throw new Error(`Failed to upsert presence: ${error.message ?? "unknown"}`)
  }

  const rows = (await response.json()) as PresenceRecord[]
  return rows[0]
}

export async function updateRoomPresenceLeave(input: {
  room_uuid: string
  participant_uuid: string
}) {
  const config = requireConfig()
  const now = new Date().toISOString()

  const response = await fetch(
    restUrl(
      config,
      "presence",
      `room_uuid=eq.${encodeURIComponent(input.room_uuid)}&participant_uuid=eq.${encodeURIComponent(input.participant_uuid)}&select=*`,
    ),
    {
      method: "PATCH",
      headers: {
        ...restHeaders(config),
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        status: "left" satisfies PresenceStatus,
        left_at: now,
        updated_at: now,
      }),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    const error = await readRestError(response)
    throw new Error(`Failed to update presence: ${error.message ?? "unknown"}`)
  }

  const rows = (await response.json()) as PresenceRecord[]
  return rows[0] ?? null
}

export async function loadOnlineRoomPresence(room_uuid: string) {
  const config = getRestConfig()

  if (!config) {
    return []
  }

  const response = await fetch(
    restUrl(
      config,
      "presence",
      `room_uuid=eq.${encodeURIComponent(room_uuid)}&status=eq.entered&left_at=is.null&select=*&order=entered_at.asc`,
    ),
    {
      headers: restHeaders(config),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    return []
  }

  return (await response.json()) as PresenceRecord[]
}

export async function loadRoomPresence(room_uuid: string) {
  const config = getRestConfig()

  if (!config) {
    return []
  }

  const response = await fetch(
    restUrl(
      config,
      "presence",
      `room_uuid=eq.${encodeURIComponent(room_uuid)}&select=*&order=entered_at.desc`,
    ),
    {
      headers: restHeaders(config),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    return []
  }

  return (await response.json()) as PresenceRecord[]
}

function resolveParticipantLabel(input: {
  role: ChatParticipantRole
  user_uuid: string | null
  display_names: Map<string, string>
}) {
  if (input.user_uuid) {
    return input.display_names.get(input.user_uuid) ?? input.role
  }

  if (input.role === "guest") {
    return "Guest"
  }

  return input.role
}

export async function enrichPresenceViews(
  room_uuid: string,
  records: PresenceRecord[],
): Promise<PresenceView[]> {
  const participants = await loadRoomParticipants(room_uuid)
  const participant_map = new Map(
    participants.map((participant) => [participant.participant_uuid, participant]),
  )
  const user_uuids = participants
    .map((participant) => participant.user_uuid)
    .filter((value): value is string => Boolean(value))
  const display_names = await loadUserDisplayNames(user_uuids)

  return records.map((record) => {
    const participant = participant_map.get(record.participant_uuid)

    return {
      ...record,
      role: participant?.role ?? "admin",
      display_name: participant
        ? resolveParticipantLabel({
            role: participant.role,
            user_uuid: participant.user_uuid,
            display_names,
          })
        : "Participant",
    }
  })
}

export async function loadOnlinePresenceViews(room_uuid: string) {
  return enrichPresenceViews(room_uuid, await loadOnlineRoomPresence(room_uuid))
}

export function resolvePresenceSystemMessage(
  action: "enter" | "leave",
  display_name: string,
  _locale: ChatLocale,
) {
  if (action === "enter") {
    return resolvePresenceJoinMessage(display_name)
  }

  return resolvePresenceLeaveMessage(display_name)
}
