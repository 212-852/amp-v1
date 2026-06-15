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

type ContactUpdateBody = {
  channel: ContactRecord["channel"]
  state: ContactRecord["state"]
  receive: boolean
  last_seen_at: string
  updated_at: string
}

const CONTACT_SELECT =
  "contact_uuid,user_uuid,visitor_uuid,type,value,channel,state,receive,last_seen_at"

function contactLookupQuery(context: ContactContext) {
  const ownerFilter = context.user_uuid
    ? `user_uuid=eq.${encodeURIComponent(context.user_uuid)}`
    : `visitor_uuid=eq.${encodeURIComponent(context.visitor_uuid ?? "")}`

  return [
    ownerFilter,
    `type=eq.${encodeURIComponent(context.type)}`,
    `value=eq.${encodeURIComponent(context.value)}`,
    `select=${CONTACT_SELECT}`,
    "limit=1",
  ].join("&")
}

async function loadContact(context: ContactContext) {
  const config = getRestConfig()

  if (!config) {
    return null
  }

  const response = await fetch(restUrl(config, "contacts", contactLookupQuery(context)), {
    headers: restHeaders(config),
    cache: "no-store",
  })

  if (!response.ok) {
    const error = await readRestError(response)
    throw new Error(
      `Failed to load contact: ${error.code ?? "unknown"} ${
        error.message ?? "No PostgREST error returned"
      }`,
    )
  }

  const rows = (await response.json()) as ContactRecord[]

  return rows[0] ?? null
}

export async function upsertContact(context: ContactContext): Promise<ContactRecord | null> {
  assertContactContext(context)

  const config = getRestConfig()
  const now = new Date().toISOString()
  const receive = resolveContactReceive(context)

  if (!config) {
    return {
      ...context,
      receive,
      last_seen_at: now,
    }
  }

  const existing = await loadContact(context)

  if (existing?.contact_uuid) {
    const updateBody: ContactUpdateBody = {
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
        `contact_uuid=eq.${encodeURIComponent(existing.contact_uuid)}&select=${CONTACT_SELECT}`,
      ),
      {
        method: "PATCH",
        headers: {
          ...restHeaders(config),
          Prefer: "return=representation",
        },
        body: JSON.stringify(updateBody),
        cache: "no-store",
      },
    )

    if (!response.ok) {
      const error = await readRestError(response)
      throw new Error(
        `Failed to update contact: ${error.code ?? "unknown"} ${
          error.message ?? "No PostgREST error returned"
        }`,
      )
    }

    const rows = (await response.json()) as ContactRecord[]

    return rows[0] ?? null
  }

  const insertBody: ContactUpsertBody = {
    user_uuid: context.user_uuid,
    visitor_uuid: context.visitor_uuid,
    type: context.type,
    value: context.value,
    channel: context.channel,
    state: context.state,
    receive,
    last_seen_at: now,
    updated_at: now,
  }

  const response = await fetch(restUrl(config, "contacts", `select=${CONTACT_SELECT}`), {
    method: "POST",
    headers: {
      ...restHeaders(config),
      Prefer: "return=representation",
    },
    body: JSON.stringify(insertBody),
    cache: "no-store",
  })

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

  const config = getRestConfig()

  if (!config) {
    return
  }

  const contact = await loadContact(context)

  if (!contact?.contact_uuid) {
    await upsertContact(context)
    return
  }

  const now = new Date().toISOString()
  const response = await fetch(
    restUrl(
      config,
      "contacts",
      `contact_uuid=eq.${encodeURIComponent(contact.contact_uuid)}`,
    ),
    {
      method: "PATCH",
      headers: restHeaders(config),
      body: JSON.stringify({
        last_seen_at: now,
        updated_at: now,
      }),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    const error = await readRestError(response)
    throw new Error(
      `Failed to update contact last_seen_at: ${error.code ?? "unknown"} ${
        error.message ?? "No PostgREST error returned"
      }`,
    )
  }
}
