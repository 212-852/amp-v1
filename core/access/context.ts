import type { SourceChannel } from "@/core/auth/types"

export type AccessState = "active" | "background" | "hidden" | "offline"

export type AccessInput = {
  visitor_uuid?: unknown
  source_channel?: unknown
  state?: unknown
  receive?: unknown
  heartbeat?: unknown
}

export type AccessContext = {
  visitor_uuid: string
  source_channel: SourceChannel
  state: AccessState
  receive: boolean
  heartbeat: boolean
}

function normalizeString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function normalizeSourceChannel(value: unknown): SourceChannel {
  return value === "pwa" || value === "liff" || value === "line"
    ? value
    : "web"
}

function normalizeState(value: unknown): AccessState {
  return value === "background" || value === "hidden" || value === "offline"
    ? value
    : "active"
}

export function normalizeAccessContext(input: AccessInput): AccessContext {
  const visitor_uuid = normalizeString(input.visitor_uuid)

  if (!visitor_uuid) {
    throw new Error("Access context requires visitor_uuid")
  }

  return {
    visitor_uuid,
    source_channel: normalizeSourceChannel(input.source_channel),
    state: normalizeState(input.state),
    receive: input.receive === false ? false : true,
    heartbeat: input.heartbeat === true,
  }
}
