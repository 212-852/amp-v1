import { headers } from "next/headers"

import { is_line_in_app_browser } from "@/core/entry/debug"
import { sendAuthDebug } from "@/core/debug"

export type LineAuthDebugEvent =
  | "ENTRY_OPENED"
  | "LOGIN_STARTED"
  | "CALLBACK_RECEIVED"
  | "SESSION_WRITTEN"
  | "ROUTE_GUARD_CHECKED"
  | "LOOP_BLOCKED"
  | "LOGIN_FAILED"
  | "SESSION_FAILED"

export async function resolve_line_browser_debug_context() {
  const requestHeaders = await headers()
  const user_agent = requestHeaders.get("user-agent")

  return {
    is_line_browser: is_line_in_app_browser(user_agent),
    user_agent,
  }
}

export async function send_line_auth_debug(
  event: LineAuthDebugEvent,
  payload: Record<string, unknown>,
  request_id?: string | null,
) {
  const context = await resolve_line_browser_debug_context()

  if (!context.is_line_browser && payload.is_line_browser !== true) {
    return
  }

  await sendAuthDebug(
    `AUTH_LINE_${event}`,
    {
      ...payload,
      is_line_browser: payload.is_line_browser ?? context.is_line_browser,
    },
    request_id,
  )
}
