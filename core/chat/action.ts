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
  archivePreparedMessage,
  archiveBotTriggerMessage,
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
  findChatRoomState,
  loadChatRoomStateByUuid,
} from "@/core/chat/room"
import type {
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
import { recordSecurityAccessEvent } from "@/core/access"
import type { Session } from "@/core/auth/types"
import {
  canToggleConciergeAvailability,
  ConciergeToggleDeniedError,
  resolveConciergeToggleResolvedRole,
} from "@/core/chat/concierge_access"

type ChatBootstrapDebugEvent =
  | "chat_bootstrap_requested"
  | "chat_bootstrap_room_created"
  | "chat_bootstrap_room_reused"
  | "chat_bootstrap_welcome_created"

async function readChatBootstrapDebugContext(session: Session) {
  let request_id: string | null = null
  let pathname: string | null = null

  try {
    const { headers } = await import("next/headers")
    const request_headers = await headers()

    request_id = request_headers.get("x-amp-request-id")
    pathname =
      request_headers.get("x-amp-pathname") ??
      request_headers.get("x-amp-route")
  } catch {
    // headers unavailable outside request scope
  }

  return {
    visitor_uuid: session.visitor_uuid,
    user_uuid: session.user_uuid,
    room_uuid: null as string | null,
    request_id,
    pathname,
  }
}

function logChatBootstrap(
  event: ChatBootstrapDebugEvent,
  data: Record<string, unknown>,
) {
  console.info(`[chat_bootstrap] ${event}`, data)
}

export async function handleChatRoomBootstrap(input: {
  source_channel: Session["source_channel"]
  locale?: string | null
  session: Session
}): Promise<ChatRoomState> {
  const debug = await readChatBootstrapDebugContext(input.session)

  logChatBootstrap("chat_bootstrap_requested", debug)

  const context = buildChatContext(input.session, {
    source_channel: input.source_channel,
    locale: input.locale ?? null,
  })
  const result = await bootstrapChatRoom(context, input.session)
  const state = await findChatRoomState(context, input.session)

  if (!state) {
    throw new Error("Failed to bootstrap chat room")
  }

  const debug_with_room = {
    ...debug,
    room_uuid: state.room.room_uuid,
  }

  if (result.created) {
    logChatBootstrap("chat_bootstrap_room_created", debug_with_room)
  } else {
    logChatBootstrap("chat_bootstrap_room_reused", debug_with_room)
  }

  if (result.welcome_created) {
    logChatBootstrap("chat_bootstrap_welcome_created", debug_with_room)
  }

  return state
}

export async function resolveChatRoom(
  session: Session,
  input?: {
    source_channel?: Session["source_channel"]
    locale?: string | null
  },
): Promise<ChatRoomState | null> {
  const context = buildChatContext(session, {
    source_channel: input?.source_channel ?? session.source_channel,
    locale: input?.locale ?? null,
  })

  return findChatRoomState(context, session)
}

export async function loadChatRoom(
  session: Session,
  input?: {
    source_channel?: Session["source_channel"]
    locale?: string | null
  },
): Promise<ChatRoomState | null> {
  const context = buildChatContext(session, {
    source_channel: input?.source_channel ?? session.source_channel,
    locale: input?.locale ?? null,
  })

  return findChatRoomState(context, session)
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

  const message = await archivePreparedMessage({
          room: updated_room,
          participant,
          source_channel: input.source_channel,
          source_kind: "system",
          type: "system",
          body: resolveModeChangeSystemMessage(mode),
          original_locale: updated_room.locale,
          session: input.session,
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

export async function handleQuickMenuRequested(input: {
  source_channel: Session["source_channel"]
  locale?: string | null
  session: Session
}) {
  const context = buildChatContext(input.session, {
    source_channel: input.source_channel,
    locale: input.locale ?? null,
  })
  const { room, participant } = await bootstrapChatRoom(context, input.session)
  const message = await archiveBotTriggerMessage({
    trigger: "quick_menu_requested",
    room,
    participant,
    session: input.session,
    source_channel: input.source_channel,
  })

  return toMessageBundle(message, room.locale)
}

export async function handleChatTyping(input: ChatTypingInput) {
  const context = normalizeTypingInput(input)
  const state = await findChatRoomState(context, input.session)

  if (!state) {
    return {
      event: resolveTypingEvent(input.is_typing),
      timeout_ms: input.is_typing ? 5000 : null,
    }
  }

  const { room, participant } = state

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

type ConciergeToggleDebugEvent =
  | "concierge_toggle_requested"
  | "concierge_toggle_denied"
  | "concierge_toggle_allowed"
  | "concierge_toggle_updated"

async function readConciergeToggleDebugContext(session: Session) {
  let request_id: string | null = null
  let pathname: string | null = null
  let ip: string | null = null
  let user_agent: string | null = null

  try {
    const { headers } = await import("next/headers")
    const request_headers = await headers()

    request_id = request_headers.get("x-amp-request-id")
    pathname =
      request_headers.get("x-amp-pathname") ??
      request_headers.get("x-amp-route") ??
      "/api/chat/concierge"
    ip =
      request_headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request_headers.get("x-real-ip")
    user_agent = request_headers.get("user-agent")
  } catch {
    // headers unavailable outside request scope
  }

  return {
    request_id,
    pathname,
    user_uuid: session.user_uuid,
    visitor_uuid: session.visitor_uuid,
    role: session.role,
    tier: session.tier,
    resolved_role: resolveConciergeToggleResolvedRole(session),
    ip,
    user_agent,
  }
}

function logConciergeToggle(
  event: ConciergeToggleDebugEvent,
  data: Record<string, unknown>,
) {
  console.info(`[concierge_toggle] ${event}`, data)
}

export async function toggleConciergeAvailability(input: {
  available: boolean
  session: Session
}) {
  const debug = await readConciergeToggleDebugContext(input.session)

  logConciergeToggle("concierge_toggle_requested", {
    ...debug,
    available: input.available,
  })

  if (!canToggleConciergeAvailability(input.session)) {
    logConciergeToggle("concierge_toggle_denied", debug)

    await recordSecurityAccessEvent({
      request_id: debug.request_id,
      category: "security",
      severity: "warning",
      event: "admin_page_forbidden",
      pathname: debug.pathname ?? "/api/chat/concierge",
      user_uuid: debug.user_uuid,
      visitor_uuid: debug.visitor_uuid,
      role: debug.role,
      tier: typeof debug.tier === "string" ? debug.tier : null,
      ip: debug.ip,
      user_agent: debug.user_agent,
      notify_payload: {
        resolved_role: debug.resolved_role,
        source: "concierge_toggle",
      },
    }).catch(() => null)

    throw new ConciergeToggleDeniedError("Concierge toggle denied")
  }

  logConciergeToggle("concierge_toggle_allowed", debug)

  const result = await setConciergeAvailability({
    available: input.available,
    updated_by: input.session.user_uuid,
  })

  logConciergeToggle("concierge_toggle_updated", {
    ...debug,
    available: result.available,
  })

  return result
}

export async function getConciergeAvailabilityState() {
  const { loadConciergeAvailability } = await import("@/core/chat/archive")
  return { available: await loadConciergeAvailability() }
}
