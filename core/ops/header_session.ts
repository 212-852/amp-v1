export type HeaderSessionLike = {
  visitor_uuid?: string | null
  user_uuid?: string | null
  display_name?: string | null
  role?: string | null
  tier?: string | null
  image_url?: string | null
}

export type OpsHeaderSession = {
  visitor_uuid: string | null
  user_uuid: string | null
  role: string
  tier: string | null
  display_name: string
  image_url: string | null
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

  return {
    visitor_uuid: session?.visitor_uuid ?? null,
    user_uuid: session?.user_uuid ?? null,
    role: session?.role ?? default_role,
    tier: session?.tier ?? null,
    display_name: session?.display_name ?? default_display_name,
    image_url: session?.image_url ?? null,
  }
}
