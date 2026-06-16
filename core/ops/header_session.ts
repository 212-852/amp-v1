import type { SessionProvider } from "@/core/auth/types"

export type HeaderSessionLike = {
  visitor_uuid?: string | null
  user_uuid?: string | null
  display_name?: string | null
  role?: string | null
  tier?: string | null
  image_url?: string | null
  provider?: SessionProvider | null
  can_logout?: boolean
}

export type OpsHeaderSession = {
  visitor_uuid: string | null
  user_uuid: string | null
  role: string
  tier: string | null
  display_name: string
  image_url: string | null
  provider: SessionProvider | null
  can_logout: boolean
}

function resolveHeaderTier(
  tier: string | null | undefined,
  user_uuid: string | null,
): string | null {
  const normalized =
    typeof tier === "string" && tier.trim() ? tier.trim().toLowerCase() : null

  if (!normalized) {
    return null
  }

  if (user_uuid && normalized === "guest") {
    return null
  }

  return normalized
}

export function normalizeOpsHeaderDisplay(
  session?: HeaderSessionLike | null,
): OpsHeaderSession {
  const user_uuid = session?.user_uuid ?? null

  if (user_uuid) {
    const role = session?.role ?? "guest"

    return {
      visitor_uuid: session?.visitor_uuid ?? null,
      user_uuid,
      role,
      tier: resolveHeaderTier(session?.tier ?? null, user_uuid),
      display_name: session?.display_name ?? role,
      image_url: session?.image_url ?? null,
      provider: session?.provider ?? null,
      can_logout: session?.can_logout ?? false,
    }
  }

  return {
    visitor_uuid: session?.visitor_uuid ?? null,
    user_uuid: null,
    role: "Guest",
    tier: null,
    display_name: "Guest",
    image_url: null,
    provider: null,
    can_logout: false,
  }
}

export function normalizeOpsHeaderSession(
  session?: HeaderSessionLike | null,
  options?: {
    default_display_name?: string
    default_role?: string
  },
): OpsHeaderSession {
  const default_display_name = options?.default_display_name ?? "Admin"
  const default_role = options?.default_role ?? "admin"
  const user_uuid = session?.user_uuid ?? null

  return {
    visitor_uuid: session?.visitor_uuid ?? null,
    user_uuid,
    role: session?.role ?? default_role,
    tier: resolveHeaderTier(session?.tier ?? null, user_uuid),
    display_name: session?.display_name ?? default_display_name,
    image_url: session?.image_url ?? null,
    provider: session?.provider ?? null,
    can_logout: session?.can_logout ?? false,
  }
}
