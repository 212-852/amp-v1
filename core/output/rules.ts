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
}

export type OutputDestination = {
  contact: ContactRecord | null
  transport: "line" | "web" | "push" | "discord" | "none"
}

const CONTACT_SELECT =
  "user_uuid,visitor_uuid,type,value,channel,state,receive,last_seen_at"

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
    return [{ contact: null, transport: "web" }]
  }

  if (target.channel === "line") {
    const line_contact = contacts.find((contact) => {
      return contact.receive && contact.type === "line"
    })

    return [{ contact: line_contact ?? null, transport: "line" }]
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
    return [{ contact: onlineContact, transport: "web" }]
  }

  contacts.forEach((contact) => {
    if (!contact.receive) {
      return
    }

    if (contact.type === "line") {
      destinations.push({ contact, transport: "line" })
      return
    }

    if (contact.type === "discord") {
      destinations.push({ contact, transport: "discord" })
      return
    }

    if (contact.type === "push") {
      destinations.push({ contact, transport: "push" })
    }
  })

  return destinations.length > 0
    ? destinations
    : [{ contact: null, transport: "none" }]
}
