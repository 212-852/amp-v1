import { getRestConfig, readRestError, restHeaders, restUrl } from "@/core/db/rest"
import type { ContactContext } from "@/core/contacts/context"
import { assertContactContext, type ContactRecord } from "@/core/contacts/rules"

type ContactUpsertBody = {
  user_uuid: string | null
  visitor_uuid: string | null
  type: ContactRecord["type"]
  value: string
  updated_at: string
}

const CONTACT_SELECT = "contact_uuid,user_uuid,visitor_uuid,type,value"

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
    }
  }

  const body: ContactUpsertBody = {
    user_uuid: context.user_uuid,
    visitor_uuid: context.user_uuid ? null : context.visitor_uuid,
    type: context.type,
    value: context.value,
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
