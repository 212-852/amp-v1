import {
  hasAccessEventBeenRecorded,
  markAccessEventRecorded,
} from "@/core/access/dedup"
import { archiveSecurityAccessLog } from "@/core/access/archive"
import type { NotifyEventName } from "@/core/notify/rules"

export type SecurityAccessEventName =
  | "admin_page_unauthorized_access"
  | "driver_page_unauthorized_access"
  | "admin_page_forbidden"
  | "admin_role_mismatch"
  | "auth_session_tampering"

export type SecurityAccessEventInput = {
  request_id: string | null
  category: "security"
  severity: "high" | "normal" | "warning"
  event: SecurityAccessEventName
  pathname: string
  user_uuid: string | null
  visitor_uuid: string | null
  role: string
  tier: string | null
  ip: string | null
  user_agent: string | null
  notify_payload?: Record<string, unknown>
}

const notify_events = new Set<NotifyEventName>([
  "admin_page_unauthorized_access",
  "driver_page_unauthorized_access",
])

async function logAccessDebug(
  event: string,
  payload: Record<string, unknown>,
) {
  console.warn(`[access] ${event}`, payload)

  try {
    const { sendAuthDebug } = await import("@/core/debug")
    await sendAuthDebug(event, payload, payload.request_id as string | null)
  } catch (error) {
    console.warn(`[access] debug_log_failed`, { event, error })
  }
}

export async function recordSecurityAccessEvent(input: SecurityAccessEventInput) {
  if (!input.request_id) {
    await logAccessDebug("access_log_archive_skipped", {
      reason: "missing_request_id",
      event: input.event,
      pathname: input.pathname,
    })
    return
  }

  if (hasAccessEventBeenRecorded(input.request_id, input.event)) {
    await logAccessDebug("access_log_archive_skipped", {
      reason: "duplicate_request",
      event: input.event,
      request_id: input.request_id,
    })
    return
  }

  const archive_result = await archiveSecurityAccessLog({
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
  })

  if (!archive_result.archived) {
    if (archive_result.reason === "duplicate") {
      markAccessEventRecorded(input.request_id, input.event)
      await logAccessDebug("access_log_archive_skipped", {
        reason: "duplicate_request",
        event: input.event,
        request_id: input.request_id,
      })
      return
    }

    await logAccessDebug("access_log_archive_failed", {
      event: input.event,
      request_id: input.request_id,
      reason: archive_result.reason,
      error_code:
        "error_code" in archive_result ? archive_result.error_code : null,
      error_message:
        "error_message" in archive_result ? archive_result.error_message : null,
      pathname: input.pathname,
    })
    return
  }

  markAccessEventRecorded(input.request_id, input.event)

  await logAccessDebug("access_log_archived", {
    event: input.event,
    request_id: input.request_id,
    category: input.category,
    severity: input.severity,
    pathname: input.pathname,
  })

  const { notifyEvent } = await import("@/core/notify")

  if (notify_events.has(input.event as NotifyEventName)) {
    await notifyEvent({
      event: input.event as NotifyEventName,
      request_id: input.request_id,
      payload: input.notify_payload ?? {
        pathname: input.pathname,
        role: input.role,
        tier: input.tier,
        user_uuid: input.user_uuid,
        visitor_uuid: input.visitor_uuid,
        request_id: input.request_id,
        user_agent: input.user_agent,
        ip: input.ip,
        resolved_role: input.role,
      },
    })
  }
}
