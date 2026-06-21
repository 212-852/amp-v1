import {
  PWA_LOGIN_PENDING_KEY,
} from "@/components/pwa/login_pending"
import { send_chat_realtime_debug } from "@/components/chat/realtime_debug"
import { create_browser_supabase_client } from "@/src/lib/supabase/client"

export const PWA_LOGIN_COMPLETE_EVENT = "amp-pwa-login-complete"

export type PwaAuthSessionPollResult = {
  ok: boolean
  restored: boolean
  user_uuid: string | null
  route_path: string | null
}

export function isPwaLoginPending() {
  if (typeof window === "undefined") {
    return false
  }

  return localStorage.getItem(PWA_LOGIN_PENDING_KEY) === "true"
}

export function setPwaLoginPending() {
  localStorage.setItem(PWA_LOGIN_PENDING_KEY, "true")
}

export function clearPwaLoginPending() {
  localStorage.removeItem(PWA_LOGIN_PENDING_KEY)
  localStorage.removeItem("amp_line_bridge_uuid")
}

export async function pollPwaAuthSession(): Promise<PwaAuthSessionPollResult> {
  const bridge_uuid =
    typeof window === "undefined"
      ? null
      : localStorage.getItem("amp_line_bridge_uuid")

  if (bridge_uuid) {
    const bridge_response = await fetch(
      `/api/auth/bridge/status?bridge_uuid=${encodeURIComponent(bridge_uuid)}`,
      {
        method: "GET",
        credentials: "include",
        headers: {
          "x-amp-channel": "pwa",
        },
        cache: "no-store",
      },
    )

    const bridge_payload = (await bridge_response.json().catch(() => null)) as {
      ok?: boolean
      success?: boolean
      session?: { user_uuid?: string | null }
      route?: { path?: string | null }
    } | null

    if (bridge_payload?.success === true && bridge_payload.session?.user_uuid) {
      return {
        ok: bridge_response.ok && bridge_payload.ok === true,
        restored: true,
        user_uuid: bridge_payload.session.user_uuid,
        route_path: bridge_payload.route?.path ?? null,
      }
    }
  }

  const response = await fetch("/api/auth/session", {
    method: "GET",
    credentials: "include",
    headers: {
      "x-amp-channel": "pwa",
    },
    cache: "no-store",
  })

  const payload = (await response.json().catch(() => null)) as {
    ok?: boolean
    restored?: boolean
    session?: { user_uuid?: string | null }
    route?: { path?: string | null }
  } | null

  return {
    ok: response.ok && payload?.ok === true,
    restored: payload?.restored === true,
    user_uuid: payload?.session?.user_uuid ?? null,
    route_path: payload?.route?.path ?? null,
  }
}

export function resolvePwaLoginDestination(route_path: string | null) {
  if (!route_path?.startsWith("/") || route_path.startsWith("/api/")) {
    return "/app"
  }

  return route_path
}

function cleanupChatRealtimeBeforeLoginComplete(input: {
  user_uuid: string
  route_path: string
  source: string
  bridge_uuid?: string | null
}) {
  let channel_count: number | null = null
  let error_message: string | null = null

  try {
    const supabase = create_browser_supabase_client()
    channel_count = supabase.getChannels().length
    void supabase.removeAllChannels()
  } catch (error) {
    error_message = error instanceof Error ? error.message : String(error)
  }

  window.dispatchEvent(
    new CustomEvent("amp-auth-session-switch", {
      detail: {
        reason: "pwa_login_polling_user_found",
        user_uuid: input.user_uuid,
        route_path: input.route_path,
        source: input.source,
        bridge_uuid: input.bridge_uuid ?? null,
      },
    }),
  )

  send_chat_realtime_debug("user_chat_realtime_unsubscribe", {
    view: "user",
    reason: "pwa_login_polling_user_found",
    current_user_uuid: input.user_uuid,
    room_uuid: null,
    visitor_uuid: null,
    route_path: input.route_path,
    source: input.source,
    bridge_uuid: input.bridge_uuid ?? null,
    channel_count,
    error_message,
  })
}

export function completePwaLogin(input: {
  user_uuid: string
  route_path: string | null
  source: string
  bridge_uuid?: string | null
  navigate?: (destination: string) => void
  on_debug?: (event: string, payload: Record<string, unknown>) => void
}) {
  clearPwaLoginPending()

  const destination = resolvePwaLoginDestination(input.route_path)

  cleanupChatRealtimeBeforeLoginComplete({
    user_uuid: input.user_uuid,
    route_path: destination,
    source: input.source,
    bridge_uuid: input.bridge_uuid ?? null,
  })

  input.on_debug?.("pwa_login_polling_user_found", {
    bridge_uuid: input.bridge_uuid ?? null,
    user_uuid: input.user_uuid,
    route_path: destination,
    source: input.source,
  })
  input.on_debug?.("pwa_login_route_resolved", {
    bridge_uuid: input.bridge_uuid ?? null,
    user_uuid: input.user_uuid,
    route_path: destination,
    raw_route_path: input.route_path,
    source: input.source,
  })
  input.on_debug?.("pwa_bridge_redirect_route_resolved", {
    bridge_uuid: input.bridge_uuid ?? null,
    user_uuid: input.user_uuid,
    route_path: destination,
    raw_route_path: input.route_path,
    source: input.source,
  })
  input.on_debug?.("pwa_login_redirect_start", {
    bridge_uuid: input.bridge_uuid ?? null,
    user_uuid: input.user_uuid,
    route_path: destination,
    source: input.source,
  })
  input.on_debug?.("pwa_login_location_replace_called", {
    bridge_uuid: input.bridge_uuid ?? null,
    user_uuid: input.user_uuid,
    route_path: destination,
    source: input.source,
  })
  input.on_debug?.("pwa_bridge_location_replace_called", {
    bridge_uuid: input.bridge_uuid ?? null,
    user_uuid: input.user_uuid,
    route_path: destination,
    source: input.source,
  })
  input.on_debug?.("pwa_login_reload_triggered", {
    bridge_uuid: input.bridge_uuid ?? null,
    user_uuid: input.user_uuid,
    route_path: destination,
    source: input.source,
  })

  input.on_debug?.("pwa_login_redirect_complete", {
    bridge_uuid: input.bridge_uuid ?? null,
    user_uuid: input.user_uuid,
    route_path: destination,
    source: input.source,
  })

  window.dispatchEvent(
    new CustomEvent(PWA_LOGIN_COMPLETE_EVENT, {
      detail: {
        user_uuid: input.user_uuid,
        route_path: destination,
      },
    }),
  )

  if (input.navigate) {
    input.navigate(destination)
    return
  }

  window.location.replace(destination)
}
