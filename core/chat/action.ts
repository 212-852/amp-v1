import { normalizeIncomingChatInput, normalizeModeSwitchInput, normalizeTypingInput, resolveChatLocale } from "@/core/chat/context"
import { resolveModeSwitchMessage } from "@/core/chat/rules"
import { resolveChatSupportAccess } from "@/core/chat/support"
import {
  clearTypingState,
  setConciergeAvailability,
  updateRoomMode,
  upsertTypingState,
} from "@/core/chat/archive"
import {
  archivePreparedMessage,
  deliverMessageBundle,
  toMessageBundle,
} from "@/core/chat/message"
import { loadChatRoomState, bootstrapChatRoom } from "@/core/chat/room"
import type {
  ChatIncomingInput,
  ChatModeSwitchInput,
  ChatRoomState,
  ChatTypingInput,
  MessageBundle,
} from "@/core/chat/types"
import { assertMessageBody, assertRoomMode } from "@/core/chat/rules"
import type { Session } from "@/core/auth/types"
import { buildChatContext } from "@/core/chat/context"

export async function resolveChatRoom(session: Session, input?: {
  source_channel?: Session["source_channel"]
  locale?: string | null
}): Promise<ChatRoomState> {
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

  await clearTypingState({
    room_uuid: room.room_uuid,
    participant_uuid: participant.participant_uuid,
  })

  const message = await archivePreparedMessage({
    room,
    participant,
    source_channel: input.source_channel,
    kind: "user",
    body,
    original_locale: resolveChatLocale(input.locale, room.locale),
    session: input.session,
  })

  await deliverMessageBundle({
    message,
    session: input.session,
    source_channel: input.source_channel,
  })

  return toMessageBundle(message)
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

  const message = await archivePreparedMessage({
    room: updated_room,
    participant,
    source_channel: input.source_channel,
    kind: "system",
    body: resolveModeSwitchMessage(mode, updated_room.locale),
    original_locale: updated_room.locale,
    session: input.session,
  })

  await deliverMessageBundle({
    message,
    session: input.session,
    source_channel: input.source_channel,
  })

  return {
    room: updated_room,
    message: toMessageBundle(message),
  }
}

export async function handleChatTyping(input: ChatTypingInput) {
  const context = normalizeTypingInput(input)
  const { room, participant } = await bootstrapChatRoom(context, input.session)

  if (!input.is_typing) {
    await clearTypingState({
      room_uuid: room.room_uuid,
      participant_uuid: participant.participant_uuid,
    })

    return { typing: false }
  }

  await upsertTypingState({
    room_uuid: room.room_uuid,
    participant_uuid: participant.participant_uuid,
    display_name: participant.display_name ?? "Guest",
    locale: room.locale,
  })

  return { typing: true, timeout_ms: 5000 }
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
