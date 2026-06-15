import { getRestConfig, readRestError, restHeaders, restUrl } from "@/core/db/rest"
import type { ContactContext } from "@/core/contacts/context"
import { assertContactContext, resolveContactReceive, type ContactRecord } from "@/core/contacts/rules"

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

const CONTACT_SELECT =
  "contact_uuid,user_uuid,visitor_uuid,type,value,channel,state,receive,last_seen_at"

function shouldUseVisitorConflict(context: ContactContext) {
  return Boolean(context.visitor_uuid) && (
    !context.user_uuid ||
    (context.type === "push" && context.channel !== "line")
  )
}

function contactConflictTarget(context: ContactContext) {
  return shouldUseVisitorConflict(context) ? "visitor_uuid,type" : "user_uuid,type"
}

function contactOwnerValues(context: ContactContext) {
  if (shouldUseVisitorConflict(context)) {
    return {
      user_uuid: null,
      visitor_uuid: context.visitor_uuid,
    }
  }

  return {
    user_uuid: context.user_uuid,
    visitor_uuid: null,
  }
}

function assertContactOwner(context: ContactContext) {
  if (shouldUseVisitorConflict(context) && !context.visitor_uuid) {
    throw new Error("Visitor contact requires visitor_uuid")
  }

  if (!shouldUseVisitorConflict(context) && !context.user_uuid) {
    throw new Error("User contact requires user_uuid")
  }
}

export async function upsertContact(context: ContactContext): Promise<ContactRecord | null> {
  assertContactContext(context)
  assertContactOwner(context)

  const config = getRestConfig()
  const now = new Date().toISOString()
  const receive = resolveContactReceive(context)
  const ownerValues = contactOwnerValues(context)

  if (!config) {
    return {
      ...context,
      ...ownerValues,
      receive,
      last_seen_at: now,
    }
  }

  const body: ContactUpsertBody = {
    ...ownerValues,
    type: context.type,
    value: context.value,
    channel: context.channel,
    state: context.state,
    receive,
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

export async function updateContactLastSeen(context: ContactContext) {
  assertContactContext(context)
  assertContactOwner(context)

  const config = getRestConfig()
  const now = new Date().toISOString()
  const ownerValues = contactOwnerValues(context)

  if (!config) {
    return
  }

  const body: ContactUpsertBody = {
    ...ownerValues,
    type: context.type,
    value: context.value,
    channel: context.channel,
    state: context.state,
    receive: resolveContactReceive(context),
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
      `Failed to upsert contact last_seen_at: ${error.code ?? "unknown"} ${
        error.message ?? "No PostgREST error returned"
      }`,
    )
  }
}

export async function updateContactState(context: ContactContext) {
  await upsertContact(context)
}
