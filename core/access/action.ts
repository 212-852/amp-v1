import { getRestConfig, restHeaders, restUrl } from "@/core/db/rest"
import type { AccessContext } from "@/core/access/context"
import { assertAccessContext, type AccessRecord } from "@/core/access/rules"

const ACCESS_SELECT =
  "visitor_uuid,user_uuid,source_channel,state,receive,last_seen_at"

type AccessBody = {
  visitor_uuid: string
  source_channel: AccessContext["source_channel"]
  state: AccessContext["state"]
  receive: boolean
  last_seen_at: string
  updated_at: string
}

export async function updateAccess(
  context: AccessContext,
): Promise<AccessRecord | null> {
  assertAccessContext(context)

  const config = getRestConfig()

  if (!config) {
    return {
      visitor_uuid: context.visitor_uuid,
      user_uuid: null,
      source_channel: context.source_channel,
      state: context.state,
      receive: context.receive,
      last_seen_at: new Date().toISOString(),
    }
  }

  const now = new Date().toISOString()
  const body: AccessBody = {
    visitor_uuid: context.visitor_uuid,
    source_channel: context.source_channel,
    state: context.state,
    receive: context.receive,
    last_seen_at: now,
    updated_at: now,
  }
  const response = await fetch(
    restUrl(
      config,
      "visitors",
      `on_conflict=visitor_uuid&select=${ACCESS_SELECT}`,
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
    return null
  }

  const rows = (await response.json()) as AccessRecord[]

  return rows[0] ?? null
}
