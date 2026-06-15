import { getRestConfig, readRestError, restHeaders, restUrl } from "@/core/db/rest"
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

const CONTACT_SELECT =
  "contact_uuid,user_uuid,visitor_uuid,type,value,channel,state,receive,last_seen_at"

const CONTACT_LINK_SELECT = "contact_uuid,visitor_uuid,type,value"

function contactConflictTarget(context: ContactContext) {
  if (context.user_uuid) {
    return "user_uuid,type,value"
  }

  return "visitor_uuid,type,value"
}

function contactUpsertIdentity(context: ContactContext) {
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
