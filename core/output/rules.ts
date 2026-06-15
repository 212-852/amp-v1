import { getRestConfig, readRestError, restHeaders, restUrl } from "@/core/db/rest"
import { isContactOnline, type ContactRecord } from "@/core/contacts/rules"

export type OutputMessage = {
  text: string
  data?: Record<string, unknown>
}

export type OutputTarget = {
  user_uuid?: string | null
  visitor_uuid?: string | null
}

export type OutputDestination = {
  contact: ContactRecord
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
  now: Date = new Date(),
): OutputDestination[] {
  return contacts.map((contact) => {
    if (!contact.receive) {
      return { contact, transport: "none" }
    }

    if (contact.channel === "line") {
      return { contact, transport: "line" }
    }

    if (
      (contact.channel === "web" ||
        contact.channel === "liff" ||
        contact.channel === "pwa") &&
      isContactOnline(contact.last_seen_at, now)
    ) {
      return { contact, transport: "web" }
    }

    if (contact.type === "line") {
      return { contact, transport: "line" }
    }

    if (contact.type === "discord") {
      return { contact, transport: "discord" }
    }

    if (contact.type === "push") {
      return { contact, transport: "push" }
    }

    return { contact, transport: "none" }
  })
}
