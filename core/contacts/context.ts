import type { SourceChannel } from "@/core/auth/types"

export type ContactType = "line" | "email" | "push" | "discord"
export type ContactState = "active" | "background" | "hidden" | "offline"

export type ContactInput = {
  user_uuid?: unknown
  visitor_uuid?: unknown
  type?: unknown
  value?: unknown
  channel?: unknown
  state?: unknown
  receive?: unknown
  heartbeat?: unknown
}

export type ContactContext = {
  user_uuid: string | null
  visitor_uuid: string | null
  type: ContactType
  value: string
}

export type ContactAccessContext = {
  user_uuid: string | null
  visitor_uuid: string | null
  channel: SourceChannel
  state: ContactState
  receive: boolean
  heartbeat: boolean
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

function normalizeChannel(value: unknown): SourceChannel {
  return value === "pwa" || value === "liff" || value === "line"
    ? value
    : "web"
}

function normalizeState(value: unknown): ContactState {
  return value === "background" || value === "hidden" || value === "offline"
    ? value
    : "active"
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
  }
}

export function normalizeContactAccessContext(
  input: ContactInput,
): ContactAccessContext {
  return {
    user_uuid: normalizeString(input.user_uuid),
    visitor_uuid: normalizeString(input.visitor_uuid),
    channel: normalizeChannel(input.channel),
    state: normalizeState(input.state),
    receive: input.receive === false ? false : true,
    heartbeat: input.heartbeat === true,
  }
}
