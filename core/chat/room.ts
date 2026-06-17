import {
  findParticipant,
  findRoomByUuid,
  insertParticipant,
  insertRoom,
  loadConciergeAvailability,
  loadRoomMessages,
  resolveRoomFromParticipants,
  updateRoomChannel,
  updateRoomLocale,
} from "@/core/chat/archive"
import {
  resolveChatLocale,
  resolveParticipantRole,
} from "@/core/chat/context"
import { bootstrapRoomWelcome } from "@/core/chat/message"
import { loadOnlinePresenceViews } from "@/core/chat/presence"
import { resolveInitialRoomMode } from "@/core/chat/rules"
import type {
  ChatContext,
  ChatLocale,
  ChatParticipantRecord,
  ChatRoomBootstrapResult,
  ChatRoomMode,
  ChatRoomRecord,
  ChatRoomState,
} from "@/core/chat/types"
import type { Session, SourceChannel } from "@/core/auth/types"

export type RoomIdentity = {
  visitor_uuid: string | null
  user_uuid: string | null
}

export type ResolvedOwnedRoom = {
  room: ChatRoomRecord
  participant: ChatParticipantRecord
  created: boolean
  participant_created: boolean
}

type RoomDebugEvent = "room_found" | "room_reused" | "room_created"

function logRoomDebug(
  event: RoomDebugEvent,
  data: Record<string, unknown>,
) {
  console.info(`[chat_room] ${event}`, data)
}

function resolveRoomIdentity(context: ChatContext, session: Session): RoomIdentity {
  const visitor_uuid = context.visitor_uuid ?? session.visitor_uuid
  const user_uuid = context.user_uuid ?? session.user_uuid

  if (!visitor_uuid && !user_uuid) {
    throw new Error("Chat requires visitor_uuid or user_uuid")
  }

  return { visitor_uuid, user_uuid }
}

function resolveOwnerParticipantRole(
  session: Session,
  user_uuid: string | null,
): "guest" | "user" {
  if (user_uuid && session.role === "user") {
    return "user"
  }

  if (user_uuid) {
    return "user"
  }

  return "guest"
}

function resolveRoomMode(session: Session): ChatRoomMode {
  return resolveInitialRoomMode(session)
}

async function touchOwnedRoom(input: {
  room: ChatRoomRecord
  participant: ChatParticipantRecord
  locale: ChatLocale
  channel: SourceChannel
  identity: RoomIdentity
}) {
  let room = await updateRoomChannel({
    room_uuid: input.room.room_uuid,
    channel: input.channel,
  })

  if (room.locale !== input.locale) {
    room = await updateRoomLocale({
      room_uuid: room.room_uuid,
      locale: input.locale,
    })
  }

  return {
    room,
    participant: input.participant,
    created: false,
    participant_created: false,
  } satisfies ResolvedOwnedRoom
}

export async function resolveOwnedRoom(input: {
  identity: RoomIdentity
  locale: ChatLocale
  channel: SourceChannel
  owner_role: "guest" | "user"
  mode: ChatRoomMode
}): Promise<ResolvedOwnedRoom> {
  const lookup = async () =>
    resolveRoomFromParticipants({
      visitor_uuid: input.identity.visitor_uuid,
      user_uuid: input.identity.user_uuid,
      mode: input.mode,
    })

  let resolved = await lookup()

  if (resolved) {
    logRoomDebug("room_found", {
      room_uuid: resolved.room.room_uuid,
      participant_uuid: resolved.participant.participant_uuid,
      mode: input.mode,
      visitor_uuid: input.identity.visitor_uuid,
      user_uuid: input.identity.user_uuid,
    })
    logRoomDebug("room_reused", {
      room_uuid: resolved.room.room_uuid,
      mode: input.mode,
      visitor_uuid: input.identity.visitor_uuid,
      user_uuid: input.identity.user_uuid,
    })

    return touchOwnedRoom({
      room: resolved.room,
      participant: resolved.participant,
      locale: input.locale,
      channel: input.channel,
      identity: input.identity,
    })
  }

  resolved = await lookup()

  if (resolved) {
    logRoomDebug("room_found", {
      room_uuid: resolved.room.room_uuid,
      participant_uuid: resolved.participant.participant_uuid,
      mode: input.mode,
      visitor_uuid: input.identity.visitor_uuid,
      user_uuid: input.identity.user_uuid,
      pass: "pre_insert_recheck",
    })
    logRoomDebug("room_reused", {
      room_uuid: resolved.room.room_uuid,
      mode: input.mode,
      visitor_uuid: input.identity.visitor_uuid,
      user_uuid: input.identity.user_uuid,
      pass: "pre_insert_recheck",
    })

    return touchOwnedRoom({
      room: resolved.room,
      participant: resolved.participant,
      locale: input.locale,
      channel: input.channel,
      identity: input.identity,
    })
  }

  const room = await insertRoom({
    mode: input.mode,
    locale: input.locale,
    channel: input.channel,
  })

  logRoomDebug("room_created", {
    room_uuid: room.room_uuid,
    mode: input.mode,
    visitor_uuid: input.identity.visitor_uuid,
    user_uuid: input.identity.user_uuid,
  })

  let participant: ChatParticipantRecord
  let participant_created = true

  try {
    participant = await insertParticipant({
      room_uuid: room.room_uuid,
      role: input.owner_role,
      visitor_uuid: input.identity.visitor_uuid,
      user_uuid: input.identity.user_uuid,
    })
  } catch (error) {
    const existing = await lookup()

    if (!existing) {
      throw new Error(
        `Failed to create room participant: ${
          error instanceof Error ? error.message : "unknown"
        }`,
      )
    }

    logRoomDebug("room_found", {
      room_uuid: existing.room.room_uuid,
      participant_uuid: existing.participant.participant_uuid,
      mode: input.mode,
      visitor_uuid: input.identity.visitor_uuid,
      user_uuid: input.identity.user_uuid,
      pass: "participant_conflict_recovery",
    })
    logRoomDebug("room_reused", {
      room_uuid: existing.room.room_uuid,
      mode: input.mode,
      visitor_uuid: input.identity.visitor_uuid,
      user_uuid: input.identity.user_uuid,
      pass: "participant_conflict_recovery",
      orphan_room_uuid: room.room_uuid,
    })

    return touchOwnedRoom({
      room: existing.room,
      participant: existing.participant,
      locale: input.locale,
      channel: input.channel,
      identity: input.identity,
    })
  }

  return {
    room,
    participant,
    created: true,
    participant_created,
  }
}

export async function findChatRoomState(
  context: ChatContext,
  session: Session,
): Promise<ChatRoomState | null> {
  const identity = resolveRoomIdentity(context, session)
  const mode = resolveRoomMode(session)
  const resolved = await resolveRoomFromParticipants({
    ...identity,
    mode,
  })

  if (!resolved) {
    return null
  }

  logRoomDebug("room_found", {
    room_uuid: resolved.room.room_uuid,
    participant_uuid: resolved.participant.participant_uuid,
    mode,
    visitor_uuid: identity.visitor_uuid,
    user_uuid: identity.user_uuid,
    pass: "find_only",
  })

  return {
    room: resolved.room,
    participant: resolved.participant,
    messages: await loadRoomMessages(resolved.room.room_uuid),
    presence: await loadOnlinePresenceViews(resolved.room.room_uuid),
    concierge_available: await loadConciergeAvailability(),
  }
}

export async function bootstrapChatRoom(
  context: ChatContext,
  session: Session,
): Promise<ChatRoomBootstrapResult> {
  const identity = resolveRoomIdentity(context, session)
  const locale = resolveChatLocale(context.locale, null)
  const owner_role = resolveOwnerParticipantRole(session, identity.user_uuid)
  const mode = resolveRoomMode(session)

  const resolved = await resolveOwnedRoom({
    identity,
    locale,
    channel: context.source_channel,
    owner_role,
    mode,
  })

  await bootstrapRoomWelcome({
    room: resolved.room,
    participant: resolved.participant,
    session,
    source_channel: context.source_channel,
  })

  return {
    room: resolved.room,
    participant: resolved.participant,
    created: resolved.created,
    participant_created: resolved.participant_created,
  }
}

export async function resolveOrCreateRoom(
  context: ChatContext,
  session: Session,
) {
  return bootstrapChatRoom(context, session)
}

export async function loadChatRoomState(
  context: ChatContext,
  session: Session,
): Promise<ChatRoomState> {
  const existing = await findChatRoomState(context, session)

  if (existing) {
    return existing
  }

  const { room, participant } = await bootstrapChatRoom(context, session)

  return {
    room,
    participant,
    messages: await loadRoomMessages(room.room_uuid),
    presence: await loadOnlinePresenceViews(room.room_uuid),
    concierge_available: await loadConciergeAvailability(),
  }
}

export async function loadChatRoomStateByUuid(
  room_uuid: string,
  session: Session,
  source_channel: Session["source_channel"],
  locale?: string | null,
): Promise<ChatRoomState | null> {
  const room = await findRoomByUuid(room_uuid)

  if (!room) {
    return null
  }

  const identity = resolveRoomIdentity(
    {
      source_channel,
      locale: resolveChatLocale(locale, room.locale),
      visitor_uuid: session.visitor_uuid,
      user_uuid: session.user_uuid,
      session_role: session.role,
      display_name: session.display_name,
      participant_uuid: null,
      room_uuid,
    },
    session,
  )

  let participant = await findParticipant({
    room_uuid: room.room_uuid,
    visitor_uuid: identity.visitor_uuid,
    user_uuid: identity.user_uuid,
  })

  if (!participant) {
    const participant_role = resolveParticipantRole(session.role)
    participant = await insertParticipant({
      room_uuid: room.room_uuid,
      role: participant_role,
      visitor_uuid: identity.visitor_uuid,
      user_uuid: identity.user_uuid,
    })
  }

  return {
    room,
    participant,
    messages: await loadRoomMessages(room.room_uuid),
    presence: await loadOnlinePresenceViews(room.room_uuid),
    concierge_available: await loadConciergeAvailability(),
  }
}
