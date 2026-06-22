import { getRestConfig, readRestError, restHeaders, restUrl } from "@/core/db/rest"
import { sendAuthDebug } from "@/core/debug"
import type { ContactAccessContext, ContactContext } from "@/core/contacts/context"
import {
  assertContactAccessContext,
  assertContactContext,
  type ContactRecord,
} from "@/core/contacts/rules"

type ContactUpsertBody = {
  user_uuid?: string | null
  visitor_uuid?: string | null
  type: ContactRecord["type"]
  value: string
  channel: ContactRecord["channel"]
  receive: boolean
}

type PushContactUpsertBody = ContactUpsertBody & {
  state: ContactRecord["state"]
  last_seen_at: string
  updated_at?: string
  endpoint: string
  p256dh: string | null
  auth: string | null
  user_agent: string | null
}

export type PushContactUpsertInput = {
  user_uuid: string | null
  visitor_uuid: string | null
  endpoint: string
  value?: string
  p256dh: string | null
  auth: string | null
  user_agent: string | null
  channel?: ContactRecord["channel"]
  state?: ContactRecord["state"]
  receive?: boolean
  last_seen_at?: string
  updated_at?: string
}

type ContactAccessBody = {
  channel?: ContactRecord["channel"]
  state?: ContactRecord["state"]
  receive?: boolean
  last_seen_at: string
  updated_at: string
}

type ContactLinkRow = {
  contact_uuid: string
  visitor_uuid: string | null
  type: ContactRecord["type"]
  value: string
}

type ContactAccessRow = {
  contact_uuid?: string | null
  state?: ContactRecord["state"] | null
}

const CONTACT_SELECT =
  "contact_uuid,user_uuid,visitor_uuid,type,value,channel,state,receive,last_seen_at"

const CONTACT_LINK_SELECT = "contact_uuid,visitor_uuid,type,value"

function contactConflictTarget(context: ContactContext) {
  if (context.type === "line") {
    return "type,value"
  }

  if (context.user_uuid) {
    return "user_uuid,type,value"
  }

  return "visitor_uuid,type,value"
}

function contactUpsertIdentity(context: ContactContext) {
  if (context.type === "line") {
    return {
      user_uuid: context.user_uuid,
      visitor_uuid: context.visitor_uuid,
    }
  }

  if (context.user_uuid) {
    return {
      user_uuid: context.user_uuid,
      visitor_uuid: null,
    }
  }

  return {
    user_uuid: null,
    visitor_uuid: context.visitor_uuid,
  }
}

async function findContactByEndpoint(
  config: NonNullable<ReturnType<typeof getRestConfig>>,
  endpoint: string,
) {
  const response = await fetch(
    restUrl(
      config,
      "contacts",
      [
        `endpoint=eq.${encodeURIComponent(endpoint)}`,
        "type=eq.push",
        `select=${CONTACT_SELECT}`,
        "limit=1",
      ].join("&"),
    ),
    {
      headers: restHeaders(config),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    return null
  }

  const rows = (await response.json()) as ContactRecord[]
  return rows[0] ?? null
}

export async function loadPushContactByEndpoint(endpoint: string) {
  const config = getRestConfig()

  if (!config || !endpoint.trim()) {
    return null
  }

  return findContactByEndpoint(config, endpoint)
}

async function findContactByTypeValue(
  config: NonNullable<ReturnType<typeof getRestConfig>>,
  input: { type: ContactRecord["type"]; value: string },
) {
  const response = await fetch(
    restUrl(
      config,
      "contacts",
      [
        `type=eq.${encodeURIComponent(input.type)}`,
        `value=eq.${encodeURIComponent(input.value)}`,
        `select=${CONTACT_SELECT}`,
        "limit=1",
      ].join("&"),
    ),
    {
      headers: restHeaders(config),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    return null
  }

  const rows = (await response.json()) as ContactRecord[]
  return rows[0] ?? null
}

async function patchContactRecord(
  config: NonNullable<ReturnType<typeof getRestConfig>>,
  contact_uuid: string,
  body: ContactUpsertBody | PushContactUpsertBody,
) {
  const response = await fetch(
    restUrl(config, "contacts", `contact_uuid=eq.${encodeURIComponent(contact_uuid)}`),
    {
      method: "PATCH",
      headers: {
        ...restHeaders(config),
        Prefer: "return=representation",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    const error = await readRestError(response)
    throw new Error(
      `Failed to patch contact: ${error.code ?? "unknown"} ${
        error.message ?? "No PostgREST error returned"
      }`,
    )
  }

  const rows = (await response.json()) as ContactRecord[]
  return rows[0] ?? null
}

async function insertContactWithoutConflict(
  config: NonNullable<ReturnType<typeof getRestConfig>>,
  body: ContactUpsertBody,
) {
  const response = await fetch(
    restUrl(config, "contacts", `select=${CONTACT_SELECT}`),
    {
      method: "POST",
      headers: {
        ...restHeaders(config),
        Prefer: "return=representation",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    const error = await readRestError(response)
    throw new Error(
      `Failed to insert contact: ${error.code ?? "unknown"} ${
        error.message ?? "No PostgREST error returned"
      }`,
    )
  }

  const rows = (await response.json()) as ContactRecord[]
  return rows[0] ?? null
}

export async function upsertPushContact(
  input: PushContactUpsertInput,
): Promise<ContactRecord | null> {
  if (!input.user_uuid && !input.visitor_uuid) {
    throw new Error("push_contact_requires_identity")
  }

  if (!input.endpoint.trim()) {
    throw new Error("push_subscription_endpoint_required")
  }

  const config = getRestConfig()
  const now = new Date().toISOString()
  const channel = input.channel ?? "pwa"
  const state = input.state ?? "active"
  const receive = input.receive !== false
  const user_uuid = input.user_uuid
  const visitor_uuid = user_uuid ? null : input.visitor_uuid

  if (!config) {
    return {
      user_uuid,
      visitor_uuid,
      type: "push",
      value: input.value ?? input.endpoint,
      channel,
      state,
      receive,
      last_seen_at: now,
    }
  }

  const body: PushContactUpsertBody = {
    user_uuid,
    visitor_uuid,
    type: "push",
    value: input.value ?? input.endpoint,
    channel,
    state,
    receive,
    last_seen_at: input.last_seen_at ?? now,
    updated_at: input.updated_at ?? now,
    endpoint: input.endpoint,
    p256dh: input.p256dh,
    auth: input.auth,
    user_agent: input.user_agent,
  }

  const existing = await findContactByEndpoint(config, input.endpoint)

  if (existing?.contact_uuid) {
    return patchContactRecord(config, existing.contact_uuid, body)
  }

  return insertContactWithoutConflict(config, body)
}

export async function upsertContact(context: ContactContext): Promise<ContactRecord | null> {
  assertContactContext(context)

  const config = getRestConfig()
  const now = new Date().toISOString()

  if (!config) {
    return {
      ...context,
      channel: context.channel,
      state: "active",
      receive: context.receive,
      last_seen_at: now,
    }
  }

  const body: ContactUpsertBody = {
    ...contactUpsertIdentity(context),
    type: context.type,
    value: context.value,
    channel: context.channel,
    receive: context.receive,
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

    if (
      context.type === "line" &&
      (error.code === "42P10" || error.message?.includes("ON CONFLICT"))
    ) {
      const existing = await findContactByTypeValue(config, {
        type: context.type,
        value: context.value,
      })

      if (existing?.contact_uuid) {
        return patchContactRecord(config, existing.contact_uuid, body)
      }

      return insertContactWithoutConflict(config, body)
    }

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

async function loadContactAccessRows(
  config: NonNullable<ReturnType<typeof getRestConfig>>,
  context: ContactAccessContext,
) {
  const response = await fetch(
    restUrl(
      config,
      "contacts",
      `${contactAccessFilter(context)}&select=contact_uuid,state`,
    ),
    {
      headers: restHeaders(config),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    return []
  }

  return (await response.json()) as ContactAccessRow[]
}

export async function updateContactAccess(
  context: ContactAccessContext,
): Promise<{
  updated_contact_uuid: string | null
  affected_rows: number
  previous_state: string | null
  next_state: ContactRecord["state"]
}> {
  assertContactAccessContext(context)

  const config = getRestConfig()

  if (!config) {
    return {
      updated_contact_uuid: null,
      affected_rows: 0,
      previous_state: null,
      next_state: context.state,
    }
  }

  const now = new Date().toISOString()
  const previous_rows = await loadContactAccessRows(config, context)
  const previous_state = previous_rows[0]?.state ?? null

  await sendAuthDebug("contact_presence_event_received", {
    user_uuid: context.user_uuid,
    visitor_uuid: context.visitor_uuid,
    channel: context.channel,
    previous_state,
    next_state: context.state,
    visibility_state: context.visibility_state,
    event_name: context.event_name,
    updated_contact_uuid: previous_rows[0]?.contact_uuid ?? null,
    affected_rows: previous_rows.length,
  })

  await sendAuthDebug("contact_presence_state_decided", {
    user_uuid: context.user_uuid,
    visitor_uuid: context.visitor_uuid,
    channel: context.channel,
    previous_state,
    next_state: context.state,
    visibility_state: context.visibility_state,
    event_name: context.event_name,
    updated_contact_uuid: previous_rows[0]?.contact_uuid ?? null,
    affected_rows: previous_rows.length,
  })

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

  await sendAuthDebug("contact_presence_update_started", {
    user_uuid: context.user_uuid,
    visitor_uuid: context.visitor_uuid,
    channel: context.channel,
    previous_state,
    next_state: context.state,
    visibility_state: context.visibility_state,
    event_name: context.event_name,
    updated_contact_uuid: previous_rows[0]?.contact_uuid ?? null,
    affected_rows: previous_rows.length,
  })

  const response = await fetch(
    restUrl(config, "contacts", contactAccessFilter(context)),
    {
      method: "PATCH",
      headers: {
        ...restHeaders(config),
        Prefer: "return=representation",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    const error = await readRestError(response)
    await sendAuthDebug("contact_presence_update_failed", {
      user_uuid: context.user_uuid,
      visitor_uuid: context.visitor_uuid,
      channel: context.channel,
      previous_state,
      next_state: context.state,
      visibility_state: context.visibility_state,
      event_name: context.event_name,
      updated_contact_uuid: previous_rows[0]?.contact_uuid ?? null,
      affected_rows: 0,
      error_message: error.message ?? "No PostgREST error returned",
      error_code: error.code ?? null,
    })
    throw new Error(
      `Failed to update contact access: ${error.code ?? "unknown"} ${
        error.message ?? "No PostgREST error returned"
      }`,
    )
  }

  const updated_rows = (await response.json()) as ContactAccessRow[]
  const result = {
    updated_contact_uuid: updated_rows[0]?.contact_uuid ?? null,
    affected_rows: updated_rows.length,
    previous_state,
    next_state: context.state,
  }

  await sendAuthDebug("contact_presence_update_success", {
    user_uuid: context.user_uuid,
    visitor_uuid: context.visitor_uuid,
    channel: context.channel,
    previous_state,
    next_state: context.state,
    visibility_state: context.visibility_state,
    event_name: context.event_name,
    updated_contact_uuid: result.updated_contact_uuid,
    affected_rows: result.affected_rows,
  })

  return result
}

export async function linkVisitorContactsToUser(
  visitor_uuid: string,
  user_uuid: string,
) {
  const config = getRestConfig()

  if (!config) {
    return
  }

  const visitorContactsResponse = await fetch(
    restUrl(
      config,
      "contacts",
      [
        `visitor_uuid=eq.${encodeURIComponent(visitor_uuid)}`,
        "user_uuid=is.null",
        `select=${CONTACT_LINK_SELECT}`,
      ].join("&"),
    ),
    {
      headers: restHeaders(config),
      cache: "no-store",
    },
  )

  if (!visitorContactsResponse.ok) {
    const error = await readRestError(visitorContactsResponse)
    throw new Error(
      `Failed to load visitor contacts: ${error.code ?? "unknown"} ${
        error.message ?? "No PostgREST error returned"
      }`,
    )
  }

  const visitorContacts = (await visitorContactsResponse.json()) as ContactLinkRow[]

  for (const contact of visitorContacts) {
    const existingUserContact = await findUserContactByTypeValue(config, {
      user_uuid,
      type: contact.type,
      value: contact.value,
    })

    if (existingUserContact) {
      if (!existingUserContact.visitor_uuid) {
        await patchContactByUuid(config, existingUserContact.contact_uuid, {
          visitor_uuid,
          updated_at: new Date().toISOString(),
        })
      }

      await deleteContactByUuid(config, contact.contact_uuid)
      continue
    }

    await patchContactByUuid(config, contact.contact_uuid, {
      user_uuid,
      updated_at: new Date().toISOString(),
    })
  }
}

async function findUserContactByTypeValue(
  config: NonNullable<ReturnType<typeof getRestConfig>>,
  input: {
    user_uuid: string
    type: ContactRecord["type"]
    value: string
  },
) {
  const response = await fetch(
    restUrl(
      config,
      "contacts",
      [
        `user_uuid=eq.${encodeURIComponent(input.user_uuid)}`,
        `type=eq.${encodeURIComponent(input.type)}`,
        `value=eq.${encodeURIComponent(input.value)}`,
        `select=${CONTACT_LINK_SELECT}`,
        "limit=1",
      ].join("&"),
    ),
    {
      headers: restHeaders(config),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    const error = await readRestError(response)
    throw new Error(
      `Failed to load user contact: ${error.code ?? "unknown"} ${
        error.message ?? "No PostgREST error returned"
      }`,
    )
  }

  const rows = (await response.json()) as ContactLinkRow[]

  return rows[0] ?? null
}

async function patchContactByUuid(
  config: NonNullable<ReturnType<typeof getRestConfig>>,
  contact_uuid: string,
  body: Partial<Pick<ContactLinkRow, "visitor_uuid">> & {
    user_uuid?: string
    updated_at: string
  },
) {
  const response = await fetch(
    restUrl(
      config,
      "contacts",
      `contact_uuid=eq.${encodeURIComponent(contact_uuid)}`,
    ),
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
      `Failed to update contact link: ${error.code ?? "unknown"} ${
        error.message ?? "No PostgREST error returned"
      }`,
    )
  }
}

async function deleteContactByUuid(
  config: NonNullable<ReturnType<typeof getRestConfig>>,
  contact_uuid: string,
) {
  const response = await fetch(
    restUrl(
      config,
      "contacts",
      `contact_uuid=eq.${encodeURIComponent(contact_uuid)}`,
    ),
    {
      method: "DELETE",
      headers: restHeaders(config),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    const error = await readRestError(response)
    throw new Error(
      `Failed to remove duplicate contact: ${error.code ?? "unknown"} ${
        error.message ?? "No PostgREST error returned"
      }`,
    )
  }
}
