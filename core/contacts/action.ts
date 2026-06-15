import { getRestConfig, readRestError, restHeaders, restUrl } from "@/core/db/rest"
import type { ContactAccessContext, ContactContext } from "@/core/contacts/context"
import {
  assertContactAccessContext,
  assertContactContext,
  type ContactRecord,
} from "@/core/contacts/rules"

type ContactUpsertBody = {
  user_uuid: string | null
  visitor_uuid: string | null
  type: ContactRecord["type"]
  value: string
  channel: ContactRecord["channel"]
  state: ContactRecord["state"]
  receive: boolean
  last_seen_at: string
  updated_at: string
}

type ContactAccessBody = {
  channel?: ContactRecord["channel"]
  state?: ContactRecord["state"]
  receive?: boolean
  last_seen_at: string
  updated_at: string
}

const CONTACT_SELECT =
  "contact_uuid,user_uuid,visitor_uuid,type,value,channel,state,receive,last_seen_at"

function contactConflictTarget(context: ContactContext) {
  if (context.user_uuid) {
    return "user_uuid,type,value"
  }

  return "visitor_uuid,type,value"
}

export async function upsertContact(context: ContactContext): Promise<ContactRecord | null> {
  assertContactContext(context)

  const config = getRestConfig()
  const now = new Date().toISOString()

  if (!config) {
    return {
      ...context,
      channel: context.type === "line" ? "line" : "web",
      state: "active",
      receive: true,
      last_seen_at: now,
    }
  }

  const body: ContactUpsertBody = {
    user_uuid: context.user_uuid,
    visitor_uuid: context.user_uuid ? null : context.visitor_uuid,
    type: context.type,
    value: context.value,
    channel: context.type === "line" ? "line" : "web",
    state: "active",
    receive: true,
    last_seen_at: now,
    updated_at: now,
  }

  const response = await fetch(
    restUrl(
      config,
      "contacts",
      `on_conflict=${contactConflictTarget(context)}&select=${CONTACT_SELECT}`,
    ),
    {
      method: "POST",
      headers: {
        ...restHeaders(config),
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    const error = await readRestError(response)
    throw new Error(
      `Failed to upsert contact: ${error.code ?? "unknown"} ${
        error.message ?? "No PostgREST error returned"
      }`,
    )
  }

  const rows = (await response.json()) as ContactRecord[]

  return rows[0] ?? null
}

function contactAccessFilter(context: ContactAccessContext) {
  if (context.user_uuid && context.visitor_uuid) {
    return `or=(user_uuid.eq.${encodeURIComponent(context.user_uuid)},visitor_uuid.eq.${encodeURIComponent(context.visitor_uuid)})`
  }

  if (context.user_uuid) {
    return `user_uuid=eq.${encodeURIComponent(context.user_uuid)}`
  }

  return `visitor_uuid=eq.${encodeURIComponent(context.visitor_uuid ?? "")}`
}

export async function updateContactAccess(
  context: ContactAccessContext,
): Promise<void> {
  assertContactAccessContext(context)

  const config = getRestConfig()

  if (!config) {
    return
  }

  const now = new Date().toISOString()
  const body: ContactAccessBody = context.heartbeat
    ? {
        last_seen_at: now,
        updated_at: now,
      }
    : {
        channel: context.channel,
        state: context.state,
        receive: context.receive,
        last_seen_at: now,
        updated_at: now,
      }

  const response = await fetch(
    restUrl(config, "contacts", contactAccessFilter(context)),
    {
      method: "PATCH",
      headers: restHeaders(config),
      body: JSON.stringify(body),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    const error = await readRestError(response)
    throw new Error(
      `Failed to update contact access: ${error.code ?? "unknown"} ${
        error.message ?? "No PostgREST error returned"
      }`,
    )
  }
}
