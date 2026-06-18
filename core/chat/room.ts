import {
  findParticipant,
  findRoomByUuid,
  insertRoom,
  loadConciergeAvailability,
  loadRoomMessages,
  updateRoomChannel,
  updateRoomLocale,
} from "@/core/chat/archive"
import {
  ensureOwnerParticipant,
  resolveOwnedParticipant,
  upsertRoomParticipant,
} from "@/core/chat/participant"
import {
  resolveChatLocale,
  resolveOutputLocale,
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
import { sendAuthDebug } from "@/core/debug"

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

type RoomDebugEvent =
  | "room_resolve_start"
  | "room_found_by_user_uuid"
  | "room_found_by_visitor_uuid"
  | "room_reused"
  | "room_created"
  | "participant_created"
  | "duplicate_room_prevented"

type RoomDebugContext = {
  visitor_uuid: string | null
  user_uuid: string | null
  room_uuid?: string | null
  request_id: string | null
  pathname: string | null
}

async function readRoomDebugContext(
  input: RoomIdentity,
  room_uuid?: string | null,
): Promise<RoomDebugContext> {
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
    visitor_uuid: input.visitor_uuid,
    user_uuid: input.user_uuid,
    room_uuid: room_uuid ?? null,
    request_id,
    pathname,
  }
}

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

async function syncRoomLocale(room: ChatRoomRecord, locale: ChatLocale) {
  if (room.locale === locale) {
    return room
  }

  return updateRoomLocale({
    room_uuid: room.room_uuid,
    locale,
  })
}

async function touchOwnedRoom(input: {
  room: ChatRoomRecord
  participant: ChatParticipantRecord
  channel: SourceChannel
  owner_role: "guest" | "user"
  identity: RoomIdentity
  output_locale: ChatLocale
}) {
  const room = await updateRoomChannel({
    room_uuid: input.room.room_uuid,
    channel: input.channel,
  })

  const synced_room = await syncRoomLocale(room, input.output_locale)

  const participant = await ensureOwnerParticipant({
    room_uuid: synced_room.room_uuid,
    role: input.owner_role,
    visitor_uuid: input.identity.visitor_uuid,
    user_uuid: input.identity.user_uuid,
  })

  return {
    room: synced_room,
    participant,
    created: false,
    participant_created: false,
  } satisfies ResolvedOwnedRoom
}

async function resolveExistingOwnedRoom(input: {
  identity: RoomIdentity
  channel: SourceChannel
  mode: ChatRoomMode
  owner_role: "guest" | "user"
  output_locale: ChatLocale
  pass?: string
  provider_user_id?: string | null
}): Promise<ResolvedOwnedRoom | null> {
  const debug = await readRoomDebugContext(input.identity)

  await sendAuthDebug("room_resolve_started", {
    provider_user_id: input.provider_user_id ?? null,
    user_uuid: input.identity.user_uuid,
    visitor_uuid: input.identity.visitor_uuid,
    source_channel: input.channel,
    pass: input.pass ?? "primary",
  })

  logRoomDebug("room_resolve_start", {
    ...debug,
    mode: input.mode,
    pass: input.pass ?? "primary",
  })

  const resolved = await resolveOwnedParticipant({
    visitor_uuid: input.identity.visitor_uuid,
    user_uuid: input.identity.user_uuid,
  })

  if (!resolved) {
    return null
  }

  const found_debug = await readRoomDebugContext(
    input.identity,
    resolved.room.room_uuid,
  )

  await sendAuthDebug("room_resolve_found", {
    room_uuid: resolved.room.room_uuid,
    by: resolved.found_by,
    participant_uuid: resolved.participant.participant_uuid,
    source_channel: input.channel,
    pass: input.pass ?? "primary",
  })

  if (resolved.found_by === "user_uuid") {
    logRoomDebug("room_found_by_user_uuid", {
      ...found_debug,
      participant_uuid: resolved.participant.participant_uuid,
      mode: input.mode,
      pass: input.pass ?? "primary",
    })
  } else {
    logRoomDebug("room_found_by_visitor_uuid", {
      ...found_debug,
      participant_uuid: resolved.participant.participant_uuid,
      mode: input.mode,
      pass: input.pass ?? "primary",
    })
  }

  const reused = await touchOwnedRoom({
    room: resolved.room,
    participant: resolved.participant,
    channel: input.channel,
    owner_role: input.owner_role,
    identity: input.identity,
    output_locale: input.output_locale,
  })

  logRoomDebug("room_reused", {
    ...found_debug,
    participant_uuid: reused.participant.participant_uuid,
    mode: input.mode,
    pass: input.pass ?? "primary",
  })

  return reused
}

export async function resolveOwnedRoom(input: {
  identity: RoomIdentity
  locale: ChatLocale
  channel: SourceChannel
  owner_role: "guest" | "user"
  mode: ChatRoomMode
  session_locale?: string | null
  browser_locale?: string | null
  provider_user_id?: string | null
}): Promise<ResolvedOwnedRoom> {
  const output_locale = resolveOutputLocale({
    preferred: input.locale,
    session_locale: input.session_locale,
    browser_locale: input.browser_locale,
  })

  const existing = await resolveExistingOwnedRoom({
    identity: input.identity,
    channel: input.channel,
    mode: input.mode,
    owner_role: input.owner_role,
    output_locale,
    provider_user_id: input.provider_user_id,
  })

  if (existing) {
    return existing
  }

  const recheck = await resolveExistingOwnedRoom({
    identity: input.identity,
    channel: input.channel,
    mode: input.mode,
    owner_role: input.owner_role,
    output_locale,
    pass: "pre_insert_recheck",
    provider_user_id: input.provider_user_id,
  })

  if (recheck) {
    const debug = await readRoomDebugContext(
      input.identity,
      recheck.room.room_uuid,
    )

    logRoomDebug("duplicate_room_prevented", {
      ...debug,
      mode: input.mode,
      pass: "pre_insert_recheck",
    })

    return recheck
  }

  const room = await syncRoomLocale(
    await insertRoom({
      mode: input.mode,
      locale: output_locale,
      channel: input.channel,
    }),
    output_locale,
  )

  const created_debug = await readRoomDebugContext(
    input.identity,
    room.room_uuid,
  )

  logRoomDebug("room_created", {
    ...created_debug,
    mode: input.mode,
  })

  await sendAuthDebug("room_resolve_created", {
    room_uuid: room.room_uuid,
    reason: "no_existing_participant_room",
    source_channel: input.channel,
    user_uuid: input.identity.user_uuid,
    visitor_uuid: input.identity.visitor_uuid,
  })

  let participant: ChatParticipantRecord
  let participant_created = false

  try {
    const upserted = await upsertRoomParticipant({
      room_uuid: room.room_uuid,
      role: input.owner_role,
      visitor_uuid: input.identity.visitor_uuid,
      user_uuid: input.identity.user_uuid,
    })
    participant = upserted.participant
    participant_created = upserted.created

    logRoomDebug("participant_created", {
      ...created_debug,
      participant_uuid: participant.participant_uuid,
      role: input.owner_role,
    })
  } catch (error) {
    const recovered = await resolveExistingOwnedRoom({
      identity: input.identity,
      channel: input.channel,
      mode: input.mode,
      owner_role: input.owner_role,
      output_locale,
      pass: "participant_conflict_recovery",
      provider_user_id: input.provider_user_id,
    })

    if (!recovered) {
      throw new Error(
        `Failed to create room participant: ${
          error instanceof Error ? error.message : "unknown"
        }`,
      )
    }

    const recovered_debug = await readRoomDebugContext(
      input.identity,
      recovered.room.room_uuid,
    )

    logRoomDebug("duplicate_room_prevented", {
      ...recovered_debug,
      mode: input.mode,
      pass: "participant_conflict_recovery",
      orphan_room_uuid: room.room_uuid,
    })

    return recovered
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
  const owner_role = resolveOwnerParticipantRole(session, identity.user_uuid)
  const output_locale = resolveOutputLocale({
    preferred: context.locale,
    room_locale: null,
  })
  const resolved = await resolveExistingOwnedRoom({
    identity,
    channel: context.source_channel,
    mode,
    owner_role,
    output_locale,
    pass: "find_only",
  })

  if (!resolved) {
    return null
  }

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
  options: {
    welcome?: boolean
    provider_user_id?: string | null
    defer_welcome_archive?: boolean
  } = {},
): Promise<ChatRoomBootstrapResult> {
  const identity = resolveRoomIdentity(context, session)
  const output_locale = resolveOutputLocale({
    preferred: context.locale,
    room_locale: null,
  })
  const owner_role = resolveOwnerParticipantRole(session, identity.user_uuid)
  const mode = resolveRoomMode(session)

  const resolved = await resolveOwnedRoom({
    identity,
    locale: output_locale,
    channel: context.source_channel,
    owner_role,
    mode,
    provider_user_id: options.provider_user_id,
  })

  const room = await syncRoomLocale(resolved.room, output_locale)

  const welcome =
    options.welcome === false
      ? null
      : await bootstrapRoomWelcome({
          room,
          participant: resolved.participant,
          session,
          source_channel: context.source_channel,
          locale: output_locale,
          defer_archive: options.defer_welcome_archive,
        })

  return {
    room,
    participant: resolved.participant,
    welcome_message: welcome,
    created: resolved.created,
    participant_created: resolved.participant_created,
    welcome_created: Boolean(welcome),
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
): Promise<ChatRoomState | null> {
  return findChatRoomState(context, session)
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
    participant = await ensureOwnerParticipant({
      room_uuid: room.room_uuid,
      role: participant_role,
      visitor_uuid: identity.visitor_uuid,
      user_uuid: identity.user_uuid,
    })

    logRoomDebug("participant_created", {
      room_uuid: room.room_uuid,
      participant_uuid: participant.participant_uuid,
      role: participant_role,
      visitor_uuid: identity.visitor_uuid,
      user_uuid: identity.user_uuid,
      pass: "admin_room_join",
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
