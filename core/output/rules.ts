import { getRestConfig, readRestError, restHeaders, restUrl } from "@/core/db/rest"
import { isContactOnline, type ContactRecord } from "@/core/contacts/rules"
import type { SourceChannel } from "@/core/auth/types"

export type OutputMessage = {
  text: string
  data?: Record<string, unknown>
  line_messages?: unknown[]
}

export type OutputTarget = {
  user_uuid?: string | null
  visitor_uuid?: string | null
  channel?: SourceChannel | null
  line_reply_token?: string | null
  line_provider_user_id?: string | null
  line_reply_allowed?: boolean
}

export type OutputDestination = {
  contact: ContactRecord | null
  transport: "line" | "web" | "push" | "discord" | "none"
  should_send: boolean
  reason: string
}

const CONTACT_SELECT =
  "user_uuid,visitor_uuid,type,value,channel,state,receive,last_seen_at"

export function isLineWebhookReplyEnabled() {
  return process.env.LINE_WEBHOOK_REPLY_ENABLED === "true"
}

function contactTargetQuery(target: OutputTarget) {
  const filters: string[] = []
  const orFilters: string[] = []

  if (target.user_uuid) {
    const userUuid = encodeURIComponent(target.user_uuid)
    filters.push(`user_uuid=eq.${userUuid}`)
    orFilters.push(`user_uuid.eq.${userUuid}`)
  }

  if (target.visitor_uuid) {
    const visitorUuid = encodeURIComponent(target.visitor_uuid)
    filters.push(`visitor_uuid=eq.${visitorUuid}`)
    orFilters.push(`visitor_uuid.eq.${visitorUuid}`)
  }

  if (filters.length === 0) {
    throw new Error("Output target requires user_uuid or visitor_uuid")
  }

  return [
    filters.length === 1 ? filters[0] : `or=(${orFilters.join(",")})`,
    `select=${CONTACT_SELECT}`,
  ].join("&")
}

export async function loadOutputContacts(target: OutputTarget) {
  const config = getRestConfig()

  if (!config) {
    return []
  }

  const response = await fetch(restUrl(config, "contacts", contactTargetQuery(target)), {
    headers: restHeaders(config),
    cache: "no-store",
  })

  if (!response.ok) {
    const error = await readRestError(response)
    throw new Error(
      `Failed to load output contacts: ${error.code ?? "unknown"} ${
        error.message ?? "No PostgREST error returned"
      }`,
    )
  }

  return (await response.json()) as ContactRecord[]
}

export function resolveOutputDestinations(
  contacts: ContactRecord[],
  target: OutputTarget = {},
  now: Date = new Date(),
): OutputDestination[] {
  if (
    target.channel === "web" ||
    target.channel === "pwa" ||
    target.channel === "liff"
  ) {
    return [{
      contact: null,
      transport: "web",
      should_send: true,
      reason: "web_channel",
    }]
  }

  if (target.channel === "line") {
    const reply_token_exists = Boolean(target.line_reply_token)
    const reply_enabled = isLineWebhookReplyEnabled()
    const line_reply_allowed = target.line_reply_allowed === true
    const line_contact = contacts.find((contact) => {
      return contact.receive && contact.type === "line"
    })

    if (reply_token_exists) {
      const should_send = line_reply_allowed && reply_enabled
      const reason = should_send
        ? "line_reply_allowed"
        : !line_reply_allowed
          ? "line_reply_not_allowed"
          : "line_reply_disabled"

      return [{
        contact: line_contact ?? null,
        transport: "line",
        should_send,
        reason,
      }]
    }

    return [{
      contact: line_contact ?? null,
      transport: "line",
      should_send: Boolean(line_contact),
      reason: line_contact ? "line_contact_found" : "line_contact_missing",
    }]
  }

  const destinations: OutputDestination[] = []
  const onlineContact = contacts.find((contact) => {
    return (
      contact.receive &&
      (contact.channel === "web" ||
        contact.channel === "pwa" ||
        contact.channel === "liff") &&
      isContactOnline(contact, now)
    )
  })

  if (onlineContact) {
    return [{
      contact: onlineContact,
      transport: "web",
      should_send: true,
      reason: "online_web_contact",
    }]
  }

  contacts.forEach((contact) => {
    if (!contact.receive) {
      return
    }

    if (contact.type === "line") {
      destinations.push({
        contact,
        transport: "line",
        should_send: true,
        reason: "line_contact_found",
      })
      return
    }

    if (contact.type === "discord") {
      destinations.push({
        contact,
        transport: "discord",
        should_send: true,
        reason: "discord_contact_found",
      })
      return
    }

    if (contact.type === "push") {
      destinations.push({
        contact,
        transport: "push",
        should_send: true,
        reason: "push_contact_found",
      })
    }
  })

  return destinations.length > 0
    ? destinations
    : [{
      contact: null,
      transport: "none",
      should_send: false,
      reason: "destination_missing",
    }]
}
