"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

type LiffProfile = {
  userId: string
  displayName?: string
  pictureUrl?: string
}

type LiffApi = {
  init: (input: { liffId: string }) => Promise<void>
  isInClient: () => boolean
  isLoggedIn: () => boolean
  login: () => void
  getProfile: () => Promise<LiffProfile>
  getIDToken: () => string | null
}

type LiffWindow = Window & {
  liff?: LiffApi
}

const LIFF_SCRIPT_SRC = "https://static.line-scdn.net/liff/edge/2/sdk.js"
const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID ?? "2006953406-vj2gYoAb"

function isLineEnvironment() {
  return navigator.userAgent.toLowerCase().includes("line")
}

function loadLiffScript() {
  const existing = document.querySelector<HTMLScriptElement>(
    `script[src="${LIFF_SCRIPT_SRC}"]`,
  )

  if (existing) {
    return Promise.resolve()
  }

  return new Promise<void>((resolve, reject) => {
    const script = document.createElement("script")
    script.src = LIFF_SCRIPT_SRC
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error("Failed to load LIFF SDK"))
    document.head.appendChild(script)
  })
}

async function postLiffDebug(event: string, payload: Record<string, unknown> = {}) {
  await fetch("/api/auth/liff/debug", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-amp-source-channel": "liff",
    },
    body: JSON.stringify({
      event,
      ...payload,
    }),
    cache: "no-store",
  }).catch(() => undefined)
}

async function postClientDebug(payload: Record<string, unknown>) {
  await fetch("/api/debug/client", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-amp-source-channel": "liff",
    },
    body: JSON.stringify({
      event: "liff_client_checked",
      ...payload,
    }),
    cache: "no-store",
  }).catch(() => undefined)
}

function id_token_has_decoded_sub(idToken: string | null) {
  if (!idToken) {
    return false
  }

  try {
    const payload = idToken.split(".")[1]

    if (!payload) {
      return false
    }

    const decoded = JSON.parse(
      atob(payload.replace(/-/g, "+").replace(/_/g, "/")),
    ) as { sub?: unknown }

    return typeof decoded.sub === "string" && decoded.sub.trim().length > 0
  } catch {
    return false
  }
}

async function linkLineProfile(profile: LiffProfile, idToken: string | null) {
  await fetch("/api/auth/liff/session", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-amp-source-channel": "liff",
      ...(idToken ? { authorization: `Bearer ${idToken}` } : {}),
    },
    body: JSON.stringify({
      provider: "line",
      provider_user_id: profile.userId,
      display_name: profile.displayName ?? null,
      source_channel: "liff",
    }),
    cache: "no-store",
  })
}

export function LiffAutoLogin() {
  const router = useRouter()

  useEffect(() => {
    let cancelled = false

    async function run() {
      if (!isLineEnvironment()) {
        return
      }

      await postLiffDebug("liff_init_started", {
        liff_id: LIFF_ID,
      })

      try {
        await loadLiffScript()

        if (cancelled) {
          return
        }

        const liff = (window as LiffWindow).liff

        if (!liff) {
          await postClientDebug({
            liff_ready: false,
            is_in_client: false,
            is_logged_in: false,
            decoded_id_token_exists: false,
            user_id_exists: false,
            error_message: "liff_sdk_missing",
          })
          return
        }

        await liff.init({ liffId: LIFF_ID })

        const is_in_client = liff.isInClient()
        const is_logged_in = liff.isLoggedIn()
        const idToken = liff.getIDToken()

        if (!is_logged_in) {
          await postClientDebug({
            liff_ready: true,
            is_in_client,
            is_logged_in: false,
            decoded_id_token_exists: id_token_has_decoded_sub(idToken),
            user_id_exists: false,
            error_message: null,
          })
          await postLiffDebug("liff_login_required", {
            liff_id: LIFF_ID,
          })
          liff.login()
          return
        }

        const profile = await liff.getProfile()

        await postClientDebug({
          liff_ready: true,
          is_in_client,
          is_logged_in: true,
          decoded_id_token_exists: id_token_has_decoded_sub(idToken),
          user_id_exists: Boolean(profile.userId),
          error_message: null,
        })

        await postLiffDebug("liff_profile_resolved", {
          line_user_id: profile.userId,
          display_name: profile.displayName ?? null,
          id_token_exists: Boolean(idToken),
        })
        await linkLineProfile(profile, idToken)

        if (!cancelled) {
          router.refresh()
        }
      } catch (error) {
        await postClientDebug({
          liff_ready: false,
          is_in_client: false,
          is_logged_in: false,
          decoded_id_token_exists: false,
          user_id_exists: false,
          error_message:
            error instanceof Error ? error.message : String(error),
        })
      }
    }

    run().catch(() => undefined)

    return () => {
      cancelled = true
    }
  }, [router])

  return null
}
