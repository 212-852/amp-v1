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
}

export type ContactContext = {
  user_uuid: string | null
  visitor_uuid: string | null
  type: ContactType
  value: string
  channel: SourceChannel
  state: ContactState
}

function normalizeString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function normalizeType(value: unknown): ContactType {
  return value === "line" ||
    value === "email" ||
    value === "push" ||
    value === "discord"
    ? value
    : "push"
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
  const channel = normalizeChannel(input.channel)
  const state = normalizeState(input.state)
  const browserPushValue =
    type === "push" && channel !== "line" && visitor_uuid
      ? `push:visitor:${visitor_uuid}`
      : null
  const value =
    normalizeString(input.value) ??
    browserPushValue ??
    (user_uuid ? `${type}:user:${user_uuid}` : null) ??
    (visitor_uuid ? `${type}:visitor:${visitor_uuid}` : null) ??
    `${type}:anonymous`

  return {
    user_uuid,
    visitor_uuid,
    type,
    value,
    channel,
    state,
  }
}
