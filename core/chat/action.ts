import {
  normalizeIncomingChatInput,
  normalizeModeSwitchInput,
  normalizeTypingInput,
  resolveChatLocale,
  resolveOutputLocale,
  resolveParticipantDisplayName,
  resolveParticipantRole,
  buildChatContext,
} from "@/core/chat/context"
import { resolveChatSupportAccess } from "@/core/chat/support"
import {
  findParticipant,
  findRoomByUuid,
  insertParticipant,
  loadConciergeAvailability,
  loadRoomParticipants,
  loadUserProfiles,
  loadRoomMessages,
  setConciergeAvailability,
  updateRoomMode,
  updateRoomThreadState,
} from "@/core/chat/archive"
import {
  archivePreparedMessage,
  archiveBotTriggerMessage,
  deliverMessageBundle,
  ensureWelcomeMessageArchived,
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
  ChatRoomMode,
  ChatRoomPresenceInput,
  ChatRoomState,
  ChatTypingInput,
  MessageBundle,
} from "@/core/chat/types"
import {
  assertMessageBody,
  assertRoomMode,
  resolve_room_mode_trigger,
  resolveRoomModeCommandReply,
} from "@/core/chat/rules"
import { recordSecurityAccessEvent } from "@/core/access"
import type { Session } from "@/core/auth/types"
import { sendAuthDebug } from "@/core/debug"
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

async function resolveConciergeCustomerName(room_uuid: string) {
  const participants = await loadRoomParticipants(room_uuid)
  const customer =
    participants.find((participant) => participant.role === "user") ??
    participants.find((participant) => participant.role === "guest") ??
    null

  if (!customer) {
    return "Customer"
  }

  if (customer.user_uuid) {
    const profiles = await loadUserProfiles([customer.user_uuid])
    const profile = profiles.get(customer.user_uuid)

    if (profile?.display_name?.trim()) {
      return profile.display_name.trim()
    }
  }

  return customer.role === "guest" ? "Guest" : "Customer"
}

async function syncConciergeOdinModeChange(input: {
  previous_room: Awaited<ReturnType<typeof bootstrapChatRoom>>["room"]
  updated_room: Awaited<ReturnType<typeof bootstrapChatRoom>>["room"]
}) {
  if (input.previous_room.mode === input.updated_room.mode) {
    return
  }

  if (
    input.updated_room.mode !== "concierge" &&
    !(input.previous_room.mode === "concierge" && input.updated_room.mode === "bot")
  ) {
    return
  }

  try {
    const { notifyEvent } = await import("@/core/notify")
    const customer_name = await resolveConciergeCustomerName(
      input.updated_room.room_uuid,
    )

    if (input.updated_room.mode === "concierge") {
      const result = await notifyEvent({
        event: "concierge_requested",
        request_id: `${input.updated_room.room_uuid}:concierge_requested:${Date.now()}`,
        payload: {
          customer_name,
          room_uuid: input.updated_room.room_uuid,
          thread_id: input.previous_room.thread_id ?? input.updated_room.thread_id ?? null,
          thread_status:
            input.previous_room.thread_status ??
            input.updated_room.thread_status ??
            "closed",
        },
      })

      if (result?.thread_id) {
        await updateRoomThreadState({
          room_uuid: input.updated_room.room_uuid,
          thread_id: result.thread_id,
          thread_status: "open",
        })
      } else {
        console.warn({
          event: "odin_room_update_failed",
          room_uuid: input.updated_room.room_uuid,
          thread_id: null,
          thread_status: "open",
          http_status: null,
          error_message: result?.reason ?? "thread_id_missing",
        })
      }
    }

    if (
      input.previous_room.mode === "concierge" &&
      input.updated_room.mode === "bot"
    ) {
      const thread_id =
        input.previous_room.thread_id ?? input.updated_room.thread_id ?? null

      const result = await notifyEvent({
        event: "concierge_closed",
        request_id: `${input.updated_room.room_uuid}:concierge_closed:${Date.now()}`,
        payload: {
          customer_name,
          room_uuid: input.updated_room.room_uuid,
          thread_id,
          thread_status:
            input.previous_room.thread_status ??
            input.updated_room.thread_status ??
            "open",
        },
      })

      if ((result?.thread_id ?? thread_id) && result?.thread_status === "closed") {
        await updateRoomThreadState({
          room_uuid: input.updated_room.room_uuid,
          thread_id: result.thread_id ?? thread_id,
          thread_status: "closed",
        })
      }
    }
  } catch (error) {
    console.warn("[concierge_odin] mode_sync_failed", {
      room_uuid: input.updated_room.room_uuid,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

async function syncConciergeOdinAdminPresence(input: {
  room: Awaited<ReturnType<typeof bootstrapChatRoom>>["room"]
  action: "enter" | "leave"
  admin_name: string
}) {
  if (input.room.mode !== "concierge") {
    return
  }

  try {
    const { notifyEvent } = await import("@/core/notify")
    const customer_name = await resolveConciergeCustomerName(input.room.room_uuid)

    const result = await notifyEvent({
      event:
        input.action === "enter"
          ? "concierge_admin_entered"
          : "concierge_admin_left",
      request_id: `${input.room.room_uuid}:concierge_admin_${input.action}:${Date.now()}`,
      payload: {
        admin_name: input.admin_name,
        customer_name,
        room_uuid: input.room.room_uuid,
        thread_id: input.room.thread_id ?? null,
        thread_status: input.room.thread_status ?? "closed",
      },
    })

    if (result?.thread_id && result.thread_status === "open" && !input.room.thread_id) {
      await updateRoomThreadState({
        room_uuid: input.room.room_uuid,
        thread_id: result.thread_id,
        thread_status: "open",
      })
    }
  } catch (error) {
    console.warn("[concierge_odin] admin_presence_sync_failed", {
      room_uuid: input.room.room_uuid,
      action: input.action,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

async function syncConciergeOdinAdminMessage(input: {
  room: Awaited<ReturnType<typeof bootstrapChatRoom>>["room"]
  admin_name: string
  message_body: string
  message_uuid: string
}) {
  if (input.room.mode !== "concierge") {
    return
  }

  try {
    const { notifyEvent } = await import("@/core/notify")
    const customer_name = await resolveConciergeCustomerName(input.room.room_uuid)

    const result = await notifyEvent({
      event: "concierge_admin_message",
      request_id: `${input.room.room_uuid}:concierge_admin_message:${input.message_uuid}`,
      payload: {
        admin_name: input.admin_name,
        customer_name,
        message_body: input.message_body,
        room_uuid: input.room.room_uuid,
        thread_id: input.room.thread_id ?? null,
        thread_status: input.room.thread_status ?? "closed",
      },
    })

    if (result?.thread_id && result.thread_status === "open" && !input.room.thread_id) {
      await updateRoomThreadState({
        room_uuid: input.room.room_uuid,
        thread_id: result.thread_id,
        thread_status: "open",
      })
    }
  } catch (error) {
    console.warn("[concierge_odin] admin_message_sync_failed", {
      room_uuid: input.room.room_uuid,
      error: error instanceof Error ? error.message : String(error),
    })
  }
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

  let result: Awaited<ReturnType<typeof bootstrapChatRoom>>

  try {
    result = await bootstrapChatRoom(context, input.session)
  } catch (error) {
    await sendAuthDebug("chat_bootstrap_failed", {
      ...debug,
      error_message: error instanceof Error ? error.message : String(error),
    })
    throw error
  }

  await ensureWelcomeMessageArchived({
    room: result.room,
    source_channel: input.source_channel,
    locale: resolveChatLocale(input.locale, result.room.locale),
  })

  const messages = await loadRoomMessages(result.room.room_uuid)
  const debug_with_room = {
    ...debug,
    room_uuid: result.room.room_uuid,
  }

  if (result.created) {
    logChatBootstrap("chat_bootstrap_room_created", debug_with_room)
  } else {
    logChatBootstrap("chat_bootstrap_room_reused", debug_with_room)
  }

  if (messages.some((message) => message.body === "welcome" && message.type === "flex")) {
    logChatBootstrap("chat_bootstrap_welcome_created", debug_with_room)
  }

  return {
    room: result.room,
    participant: result.participant,
    messages,
    presence: [],
    concierge_available: await loadConciergeAvailability(),
  }
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
  const result = await handleIncomingChatMessageArchive(input, {
    deliver: true,
    bootstrap_welcome: true,
  })

  return result.bundle
}

export type IncomingChatArchiveResult = {
  bundle: MessageBundle
  mode_command_handled: boolean
}

export async function handleIncomingChatMessageArchive(
  input: ChatIncomingInput,
  options: {
    deliver?: boolean
    deliver_mode_reply?: boolean
    bootstrap_welcome?: boolean
    apply_mode_command?: boolean
  } = {},
): Promise<IncomingChatArchiveResult> {
  const context = normalizeIncomingChatInput(input)
  const body = assertMessageBody(input.body)
  console.info("[chat_core] chat_core_entered", {
    source_channel: input.source_channel,
    user_uuid: input.session.user_uuid,
    visitor_uuid: input.session.visitor_uuid,
    has_line_reply_token: Boolean(input.line_reply_token),
  })
  const mode_command =
    options.apply_mode_command !== false
      ? resolve_room_mode_trigger(body)
      : null
  const can_use_explicit_room =
    input.session.role === "admin" ||
    input.session.role === "concierge" ||
    input.session.role === "owner"

  if (input.room_uuid && !can_use_explicit_room) {
    throw new Error("Room scoped chat requires admin access")
  }

  const explicit_room_state = input.room_uuid
    ? await loadChatRoomStateByUuid(
        input.room_uuid,
        input.session,
        input.source_channel,
        input.locale ?? null,
      )
    : null

  if (input.room_uuid && !explicit_room_state) {
    throw new Error("Room was not found")
  }

  const { room, participant } =
    explicit_room_state ?? (await bootstrapChatRoom(context, input.session))

  if (options.bootstrap_welcome !== false && !explicit_room_state) {
    await ensureWelcomeMessageArchived({
      room,
      source_channel: input.source_channel,
      locale: resolveChatLocale(input.locale, room.locale),
    })
  }

  await sendAuthDebug("chat_room_resolved", {
    user_uuid: input.session.user_uuid,
    visitor_uuid: input.session.visitor_uuid,
    room_uuid: room.room_uuid,
    room_mode: room.mode,
    source_channel: input.source_channel,
  })
  await sendAuthDebug("chat_room_mode_trigger_checked", {
    text: body,
    matched_mode: mode_command,
  })

  await broadcastTypingEvent({
    room_uuid: room.room_uuid,
    participant_uuid: participant.participant_uuid,
    display_name: resolveParticipantDisplayName(input.session, participant.role),
    locale: room.locale,
    event: "typing_stop",
  })

  if (mode_command) {
    const bundle = await handleRoomModeCommand({
      body,
      mode: mode_command,
      source_channel: input.source_channel,
      locale: input.locale,
      session: input.session,
      participant_uuid: input.participant_uuid,
      room_uuid: input.room_uuid,
      line_reply_token: input.line_reply_token,
      line_provider_user_id: input.line_provider_user_id,
      line_reply_allowed: input.line_reply_allowed,
      deliver: options.deliver_mode_reply ?? options.deliver !== false,
      room,
      participant,
    })

    return {
      bundle,
      mode_command_handled: true,
    }
  }

  const message = await archivePreparedMessage({
    room,
    participant,
    source_channel: input.source_channel,
    source_kind:
      participant.role === "admin" || participant.role === "concierge"
        ? "concierge"
        : "user",
    body,
    original_locale: resolveChatLocale(input.locale, room.locale),
    session: input.session,
    external_id: input.external_id,
  })

  await sendAuthDebug("chat_archive_incoming_saved", {
    room_uuid: room.room_uuid,
    message_uuid: message.message_uuid,
    source_channel: input.source_channel,
  })

  if (
    (participant.role === "admin" || participant.role === "concierge") &&
    room.mode === "concierge"
  ) {
    await syncConciergeOdinAdminMessage({
      room,
      admin_name: resolveParticipantDisplayName(input.session, participant.role),
      message_body: body,
      message_uuid: message.message_uuid,
    })
  }

  if (options.deliver !== false) {
    const should_deliver_incoming = !(
      input.source_channel === "line" && Boolean(input.line_reply_token)
    )

    if (should_deliver_incoming) {
      await deliverMessageBundle({
        message,
        room,
        session: input.session,
        source_channel: input.source_channel,
        line_reply_token: input.line_reply_token,
        line_provider_user_id: input.line_provider_user_id,
        line_reply_allowed: input.line_reply_allowed,
      })
    }
  }

  return {
    bundle: toMessageBundle(message, room.locale),
    mode_command_handled: false,
  }
}

async function handleRoomModeCommand(input: {
  body: string
  mode: ChatRoomMode
  source_channel: ChatIncomingInput["source_channel"]
  locale?: string | null
  session: Session
  participant_uuid?: string | null
  room_uuid?: string | null
  line_reply_token?: string | null
  line_provider_user_id?: string | null
  line_reply_allowed?: boolean
  deliver: boolean
  room: Awaited<ReturnType<typeof bootstrapChatRoom>>["room"]
  participant: Awaited<ReturnType<typeof bootstrapChatRoom>>["participant"]
}): Promise<MessageBundle> {
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

  const incoming_message = await archivePreparedMessage({
    room: input.room,
    participant: input.participant,
    source_channel: input.source_channel,
    source_kind: "user",
    body: input.body,
    original_locale: resolveChatLocale(input.locale, input.room.locale),
    session: input.session,
  })

  await sendAuthDebug("chat_archive_incoming_saved", {
    room_uuid: input.room.room_uuid,
    message_uuid: incoming_message.message_uuid,
    source_channel: input.source_channel,
  })

  const updated_room = await updateRoomMode({
    room_uuid: input.room.room_uuid,
    mode,
  })

  await sendAuthDebug("chat_room_mode_updated", {
    room_uuid: updated_room.room_uuid,
    from_mode: input.room.mode,
    to_mode: updated_room.mode,
    source_channel: input.source_channel,
  })

  await syncConciergeOdinModeChange({
    previous_room: input.room,
    updated_room,
  })

  const output_locale = resolveOutputLocale({
    preferred: input.locale,
    room_locale: input.room.locale,
  })

  const message = await archivePreparedMessage({
    room: updated_room,
    participant: input.participant,
    source_channel: input.source_channel,
    source_kind: "system",
    type: "system",
    body: resolveRoomModeCommandReply(mode, output_locale),
    original_locale: output_locale,
    session: input.session,
  })

  if (input.deliver) {
    await deliverMessageBundle({
      message,
      room: updated_room,
      session: input.session,
      source_channel: input.source_channel,
      line_reply_token: input.line_reply_token,
      line_provider_user_id: input.line_provider_user_id,
      line_reply_allowed: input.line_reply_allowed,
    })
  }

  return toMessageBundle(message, updated_room.locale)
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

  await syncConciergeOdinModeChange({
    previous_room: room,
    updated_room,
  })

  const output_locale = resolveOutputLocale({
    preferred: input.locale,
    room_locale: updated_room.locale,
  })

  const message = await archivePreparedMessage({
          room: updated_room,
          participant,
          source_channel: input.source_channel,
          source_kind: "system",
          type: "system",
          body: resolveRoomModeCommandReply(mode, output_locale),
          original_locale: output_locale,
          session: input.session,
        })

  await deliverMessageBundle({
    message,
    room: updated_room,
    session: input.session,
    source_channel: input.source_channel,
    line_reply_token: input.line_reply_token,
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
  line_reply_token?: string | null
  line_provider_user_id?: string | null
  line_reply_allowed?: boolean
  bootstrap_welcome?: boolean
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
    locale: context.locale,
    line_reply_token: input.line_reply_token,
    line_provider_user_id: input.line_provider_user_id,
    line_reply_allowed: input.line_reply_allowed,
  })

  return toMessageBundle(message, room.locale)
}

export async function handleChatTyping(input: ChatTypingInput) {
  const context = normalizeTypingInput(input)
  const can_use_explicit_room =
    input.session.role === "admin" ||
    input.session.role === "concierge" ||
    input.session.role === "owner"

  if (input.room_uuid && !can_use_explicit_room) {
    throw new Error("Room scoped typing requires admin access")
  }

  const state = input.room_uuid
    ? await loadChatRoomStateByUuid(
        input.room_uuid,
        input.session,
        input.source_channel,
        input.locale ?? null,
      )
    : await findChatRoomState(context, input.session)

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

    await syncConciergeOdinAdminPresence({
      room,
      action: "enter",
      admin_name: display_name,
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
      payload: {
        meta: {
          presence_action: "enter",
          actor_role: participant.role,
        },
      },
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

  await syncConciergeOdinAdminPresence({
    room,
    action: "leave",
    admin_name: display_name,
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
    payload: {
      meta: {
        presence_action: "leave",
        actor_role: participant.role,
      },
    },
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

export async function loadConciergeQueueForSession(
  session: Session,
  options?: { limit?: number },
) {
  const { get_concierge_queue } = await import("@/core/concierge/action")
  const result = await get_concierge_queue(session, options)
  return result.items
}

type ConciergeToggleDebugEvent =
  | "concierge_toggle_request"
  | "concierge_toggle_success"
  | "concierge_toggle_failed"
  | "concierge_toggle_denied"

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
  enabled: boolean
  session: Session
  request_body?: Record<string, unknown>
}) {
  const debug = await readConciergeToggleDebugContext(input.session)

  logConciergeToggle("concierge_toggle_request", {
    ...debug,
    request_body: input.request_body ?? null,
    enabled: input.enabled,
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

  try {
    const result = await setConciergeAvailability({
      available: input.enabled,
      updated_by: input.session.user_uuid,
    })

    logConciergeToggle("concierge_toggle_success", {
      ...debug,
      enabled: result.enabled,
    })

    return result
  } catch (error) {
    logConciergeToggle("concierge_toggle_failed", {
      ...debug,
      enabled: input.enabled,
      error_message: error instanceof Error ? error.message : String(error),
    })

    throw error
  }
}

export async function getConciergeAvailabilityState(
  session?: { user_uuid?: string | null } | null,
) {
  const { loadConciergeAvailability } = await import("@/core/chat/archive")

  let user_uuid = session?.user_uuid ?? null

  if (!user_uuid) {
    try {
      const { resolveAuthContext } = await import("@/core/auth/context")
      const { resolveSession } = await import("@/core/auth/session")
      const context = await resolveAuthContext()
      const resolved_session = await resolveSession(context)
      user_uuid = resolved_session.user_uuid
    } catch {
      user_uuid = null
    }
  }

  return { enabled: await loadConciergeAvailability(user_uuid) }
}
