import {
  normalizeIncomingChatInput,
  normalizeModeSwitchInput,
  normalizeTypingInput,
  resolveChatLocale,
  resolveParticipantDisplayName,
  resolveParticipantRole,
  buildChatContext,
} from "@/core/chat/context"
import { resolveChatSupportAccess } from "@/core/chat/support"
import {
  findParticipant,
  findRoomByUuid,
  insertParticipant,
  setConciergeAvailability,
  updateRoomMode,
} from "@/core/chat/archive"
import {
  archiveBotFixedMessage,
  archivePreparedMessage,
  deliverMessageBundle,
  toMessageBundle,
} from "@/core/chat/message"
import {
  enrichPresenceViews,
  loadOnlinePresenceViews,
  loadRoomPresence,
  resolvePresenceSystemMessage,
  updateRoomPresenceLeave,
  upsertRoomPresenceEnter,
} from "@/core/chat/presence"
import { broadcastTypingEvent, resolveTypingEvent } from "@/core/chat/realtime"
import {
  bootstrapChatRoom,
  loadChatRoomState,
  loadChatRoomStateByUuid,
} from "@/core/chat/room"
import type {
  BotMessageKey,
  ChatIncomingInput,
  ChatModeSwitchInput,
  ChatRoomPresenceInput,
  ChatRoomState,
  ChatTypingInput,
  MessageBundle,
} from "@/core/chat/types"
import {
  assertMessageBody,
  assertRoomMode,
  resolveModeChangeSystemMessage,
} from "@/core/chat/rules"
import type { Session } from "@/core/auth/types"

export async function resolveChatRoom(
  session: Session,
  input?: {
    source_channel?: Session["source_channel"]
    locale?: string | null
  },
): Promise<ChatRoomState> {
  const context = buildChatContext(session, {
    source_channel: input?.source_channel ?? session.source_channel,
    locale: input?.locale ?? null,
  })

  return loadChatRoomState(context, session)
}

export async function handleIncomingChatMessage(
  input: ChatIncomingInput,
): Promise<MessageBundle> {
  const context = normalizeIncomingChatInput(input)
  const body = assertMessageBody(input.body)
  const { room, participant } = await bootstrapChatRoom(context, input.session)

  await broadcastTypingEvent({
    room_uuid: room.room_uuid,
    participant_uuid: participant.participant_uuid,
    display_name: resolveParticipantDisplayName(input.session, participant.role),
    locale: room.locale,
    event: "typing_stop",
  })

  const message = await archivePreparedMessage({
    room,
    participant,
    source_channel: input.source_channel,
    source_kind: "user",
    body,
    original_locale: resolveChatLocale(input.locale, room.locale),
    session: input.session,
  })

  await deliverMessageBundle({
    message,
    room,
    session: input.session,
    source_channel: input.source_channel,
  })

  return toMessageBundle(message, room.locale)
}

export async function handleChatModeSwitch(input: ChatModeSwitchInput) {
  const context = normalizeModeSwitchInput(input)
  const mode = assertRoomMode(input.mode)

  if (mode === "concierge") {
    const access = resolveChatSupportAccess({
      user_uuid: input.session.user_uuid,
      role: input.session.role,
      tier: input.session.tier,
    })

    if (!access.concierge.enabled) {
      throw new Error("Concierge mode is not available")
    }
  }

  const { room, participant } = await bootstrapChatRoom(context, input.session)
  const updated_room = await updateRoomMode({
    room_uuid: room.room_uuid,
    mode,
  })

  const message =
    mode === "group"
      ? await archivePreparedMessage({
          room: updated_room,
          participant,
          source_channel: input.source_channel,
          source_kind: "system",
          type: "system",
          body: resolveModeChangeSystemMessage(mode),
          original_locale: updated_room.locale,
          session: input.session,
        })
      : await archiveBotFixedMessage({
          key: mode === "concierge" ? "concierge_mode" : "bot_mode",
          room: updated_room,
          participant,
          session: input.session,
          source_channel: input.source_channel,
        })

  await deliverMessageBundle({
    message,
    room: updated_room,
    session: input.session,
    source_channel: input.source_channel,
  })

  return {
    room: updated_room,
    message: toMessageBundle(message, updated_room.locale),
  }
}

export async function handleBotFixedMessage(input: {
  key: BotMessageKey
  source_channel: Session["source_channel"]
  locale?: string | null
  session: Session
}) {
  const context = buildChatContext(input.session, {
    source_channel: input.source_channel,
    locale: input.locale ?? null,
  })
  const { room, participant } = await bootstrapChatRoom(context, input.session)
  const message = await archiveBotFixedMessage({
    key: input.key,
    room,
    participant,
    session: input.session,
    source_channel: input.source_channel,
  })

  await deliverMessageBundle({
    message,
    room,
    session: input.session,
    source_channel: input.source_channel,
  })

  return toMessageBundle(message, room.locale)
}

export async function handleChatTyping(input: ChatTypingInput) {
  const context = normalizeTypingInput(input)
  const { room, participant } = await bootstrapChatRoom(context, input.session)

  await broadcastTypingEvent({
    room_uuid: room.room_uuid,
    participant_uuid: participant.participant_uuid,
    display_name: resolveParticipantDisplayName(input.session, participant.role),
    locale: room.locale,
    event: resolveTypingEvent(input.is_typing),
  })

  return {
    event: resolveTypingEvent(input.is_typing),
    timeout_ms: input.is_typing ? 5000 : null,
  }
}

async function resolveAdminRoomParticipant(input: {
  room_uuid: string
  session: Session
}) {
  if (input.session.role !== "admin") {
    throw new Error("Admin role required")
  }

  if (!input.session.user_uuid) {
    throw new Error("Admin presence requires user_uuid")
  }

  const room = await findRoomByUuid(input.room_uuid)

  if (!room) {
    throw new Error("Room was not found")
  }

  const role = resolveParticipantRole(input.session.role)
  let participant = await findParticipant({
    room_uuid: room.room_uuid,
    visitor_uuid: input.session.visitor_uuid,
    user_uuid: input.session.user_uuid,
  })

  if (!participant) {
    participant = await insertParticipant({
      room_uuid: room.room_uuid,
      role,
      visitor_uuid: input.session.visitor_uuid,
      user_uuid: input.session.user_uuid,
    })
  }

  return { room, participant }
}

export async function handleChatRoomPresence(input: ChatRoomPresenceInput) {
  const { room, participant } = await resolveAdminRoomParticipant({
    room_uuid: input.room_uuid,
    session: input.session,
  })

  const display_name = resolveParticipantDisplayName(input.session, participant.role)

  if (input.action === "enter") {
    const presence = await upsertRoomPresenceEnter({
      room_uuid: room.room_uuid,
      participant_uuid: participant.participant_uuid,
    })

    const message = await archivePreparedMessage({
      room,
      participant,
      source_channel: input.source_channel,
      source_kind: "system",
      type: "system",
      body: resolvePresenceSystemMessage("enter", display_name, room.locale),
      original_locale: room.locale,
      session: input.session,
    })

    await deliverMessageBundle({
      message,
      room,
      session: input.session,
      source_channel: input.source_channel,
    })

    return {
      action: input.action,
      presence,
      message: toMessageBundle(message, room.locale),
      online: await loadOnlinePresenceViews(room.room_uuid),
    }
  }

  const presence = await updateRoomPresenceLeave({
    room_uuid: room.room_uuid,
    participant_uuid: participant.participant_uuid,
  })

  const message = await archivePreparedMessage({
    room,
    participant,
    source_channel: input.source_channel,
    source_kind: "system",
    type: "system",
    body: resolvePresenceSystemMessage("leave", display_name, room.locale),
    original_locale: room.locale,
    session: input.session,
  })

  await deliverMessageBundle({
    message,
    room,
    session: input.session,
    source_channel: input.source_channel,
  })

  return {
    action: input.action,
    presence,
    message: toMessageBundle(message, room.locale),
    online: await loadOnlinePresenceViews(room.room_uuid),
  }
}

export async function resolveRoomPresence(room_uuid: string) {
  return {
    online: await loadOnlinePresenceViews(room_uuid),
    history: await enrichPresenceViews(room_uuid, await loadRoomPresence(room_uuid)),
  }
}

export async function resolveAdminChatRoom(
  room_uuid: string,
  session: Session,
  input?: {
    source_channel?: Session["source_channel"]
    locale?: string | null
  },
) {
  if (session.role !== "admin") {
    throw new Error("Admin role required")
  }

  const state = await loadChatRoomStateByUuid(
    room_uuid,
    session,
    input?.source_channel ?? session.source_channel,
    input?.locale ?? null,
  )

  if (!state) {
    throw new Error("Room was not found")
  }

  return state
}

export async function toggleConciergeAvailability(input: {
  available: boolean
  session: Session
}) {
  if (input.session.role !== "admin") {
    throw new Error("Admin role required")
  }

  return setConciergeAvailability({
    available: input.available,
    updated_by: input.session.user_uuid,
  })
}

export async function getConciergeAvailabilityState() {
  const { loadConciergeAvailability } = await import("@/core/chat/archive")
  return { available: await loadConciergeAvailability() }
}
