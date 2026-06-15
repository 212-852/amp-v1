import { getRestConfig, readRestError, restHeaders, restUrl } from "@/core/db/rest"
import type { ContactRecord } from "@/core/contacts/rules"
import { isAccessOnline, type AccessRecord } from "@/core/access/rules"

export type OutputMessage = {
  text: string
  data?: Record<string, unknown>
}

export type OutputTarget = {
  user_uuid?: string | null
  visitor_uuid?: string | null
}

export type OutputDestination = {
  contact: ContactRecord | null
  visitor: AccessRecord | null
  transport: "line" | "web" | "push" | "discord" | "none"
}

const CONTACT_SELECT = "user_uuid,visitor_uuid,type,value"
const VISITOR_SELECT =
  "visitor_uuid,user_uuid,source_channel,state,receive,last_seen_at"

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

function visitorTargetQuery(target: OutputTarget) {
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
    `select=${VISITOR_SELECT}`,
    "limit=1",
  ].join("&")
}

export async function loadOutputVisitor(target: OutputTarget) {
  const config = getRestConfig()

  if (!config) {
    return null
  }

  const response = await fetch(restUrl(config, "visitors", visitorTargetQuery(target)), {
    headers: restHeaders(config),
    cache: "no-store",
  })

  if (!response.ok) {
    const error = await readRestError(response)
    throw new Error(
      `Failed to load output visitor: ${error.code ?? "unknown"} ${
        error.message ?? "No PostgREST error returned"
      }`,
    )
  }

  const rows = (await response.json()) as AccessRecord[]

  return rows[0] ?? null
}

export function resolveOutputDestinations(
  visitor: AccessRecord | null,
  contacts: ContactRecord[],
  now: Date = new Date(),
): OutputDestination[] {
  const destinations: OutputDestination[] = []

  if (visitor?.receive && isAccessOnline(visitor, now)) {
    return [{ contact: null, visitor, transport: "web" }]
  }

  contacts.forEach((contact) => {
    if (contact.type === "line") {
      destinations.push({ contact, visitor, transport: "line" })
      return
    }

    if (contact.type === "discord") {
      destinations.push({ contact, visitor, transport: "discord" })
      return
    }

    if (contact.type === "push") {
      destinations.push({ contact, visitor, transport: "push" })
    }
  })

  return destinations.length > 0
    ? destinations
    : [{ contact: null, visitor, transport: "none" }]
}
