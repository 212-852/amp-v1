import {
  PWA_LOGIN_PENDING_KEY,
} from "@/components/pwa/login_pending"

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
  return route_path?.startsWith("/") ? route_path : "/"
}

export function completePwaLogin(input: {
  user_uuid: string
  route_path: string | null
  source: string
  bridge_uuid?: string | null
  on_debug?: (event: string, payload: Record<string, unknown>) => void
}) {
  clearPwaLoginPending()

  const destination = resolvePwaLoginDestination(input.route_path)

  input.on_debug?.("pwa_login_polling_user_found", {
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

  window.dispatchEvent(
    new CustomEvent(PWA_LOGIN_COMPLETE_EVENT, {
      detail: {
        user_uuid: input.user_uuid,
        route_path: destination,
      },
    }),
  )

  window.location.replace(destination)
}
