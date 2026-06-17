import { getRestConfig, readRestError, restHeaders, restUrl } from "@/core/db/rest"

export type SecurityAccessArchiveInput = {
  request_id: string
  category: "security"
  severity: "high" | "normal" | "warning"
  event: string
  pathname: string
  user_uuid: string | null
  visitor_uuid: string | null
  role: string
  tier: string | null
  ip: string | null
  user_agent: string | null
}

export async function archiveSecurityAccessLog(input: SecurityAccessArchiveInput) {
  const config = getRestConfig()

  if (!config) {
    return {
      archived: false,
      reason: "db_unavailable" as const,
    }
  }

  const response = await fetch(restUrl(config, "access_logs", ""), {
    method: "POST",
    headers: {
      ...restHeaders(config),
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      request_id: input.request_id,
      category: input.category,
      severity: input.severity,
      event: input.event,
      pathname: input.pathname,
      user_uuid: input.user_uuid,
      visitor_uuid: input.visitor_uuid,
      role: input.role,
      tier: input.tier,
      ip: input.ip,
      user_agent: input.user_agent,
    }),
    cache: "no-store",
  })

  if (response.status === 409) {
    return {
      archived: false,
      reason: "duplicate" as const,
    }
  }

  if (!response.ok) {
    const error = await readRestError(response)

    return {
      archived: false,
      reason: "insert_failed" as const,
      error_code: error.code ?? null,
      error_message: error.message ?? null,
    }
  }

  return {
    archived: true as const,
  }
}
