import type { SourceChannel } from "@/core/auth/types"

export type ContactType = "line" | "email" | "push" | "discord"
export type ContactState = "active" | "background" | "hidden" | "offline"

export type ContactInput = {
  user_uuid?: unknown
  visitor_uuid?: unknown
  type?: unknown
  value?: unknown
  channel?: unknown
  source_channel?: unknown
  state?: unknown
  receive?: unknown
  heartbeat?: unknown
  event_name?: unknown
  visibility_state?: unknown
}

export type ContactContext = {
  user_uuid: string | null
  visitor_uuid: string | null
  type: ContactType
  value: string
  channel: SourceChannel
  receive: boolean
}

export type ContactAccessContext = {
  user_uuid: string | null
  visitor_uuid: string | null
  channel: SourceChannel
  state: ContactState
  receive: boolean
  heartbeat: boolean
  event_name: string | null
  visibility_state: string | null
}

function normalizeString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function normalizeType(value: unknown): ContactType {
  if (
    value === "line" ||
    value === "email" ||
    value === "push" ||
    value === "discord"
  ) {
    return value
  }

  throw new Error("Contact requires a real delivery destination type")
}

function normalizeChannel(value: unknown, type?: ContactType): SourceChannel {
  return value === "pwa" || value === "liff" || value === "line"
    ? value
    : type === "line"
      ? "line"
    : "web"
}

function normalizeState(value: unknown): ContactState {
  return value === "background" || value === "hidden" || value === "offline"
    ? value
    : "active"
}

function normalizeLifecycleEventName(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function normalizeVisibilityState(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function resolveLifecycleState(input: ContactInput): ContactState {
  const event_name = normalizeLifecycleEventName(input.event_name)
  const visibility_state = normalizeVisibilityState(input.visibility_state)

  if (input.heartbeat === true) {
    return "active"
  }

  if (
    event_name === "hidden" ||
    event_name === "blur" ||
    event_name === "pagehide" ||
    event_name === "beforeunload" ||
    visibility_state === "hidden"
  ) {
    return "hidden"
  }

  if (
    event_name === "visible" ||
    event_name === "focus" ||
    event_name === "pageshow" ||
    visibility_state === "visible"
  ) {
    return "active"
  }

  return normalizeState(input.state)
}

export function normalizeContactContext(input: ContactInput): ContactContext {
  const user_uuid = normalizeString(input.user_uuid)
  const visitor_uuid = normalizeString(input.visitor_uuid)
  const type = normalizeType(input.type)
  const value = normalizeString(input.value)

  if (!value) {
    throw new Error("Contact requires a real destination value")
  }

  if (value.startsWith("push:visitor:")) {
    throw new Error("Contact requires a real delivery destination")
  }

  return {
    user_uuid,
    visitor_uuid,
    type,
    value,
    channel: normalizeChannel(input.channel ?? input.source_channel, type),
    receive: input.receive === false ? false : true,
  }
}

export function normalizeContactAccessContext(
  input: ContactInput,
): ContactAccessContext {
  return {
    user_uuid: normalizeString(input.user_uuid),
    visitor_uuid: normalizeString(input.visitor_uuid),
    channel: normalizeChannel(input.channel ?? input.source_channel),
    state: resolveLifecycleState(input),
    receive: input.receive === false ? false : true,
    heartbeat: input.heartbeat === true,
    event_name: normalizeLifecycleEventName(input.event_name),
    visibility_state: normalizeVisibilityState(input.visibility_state),
  }
}
