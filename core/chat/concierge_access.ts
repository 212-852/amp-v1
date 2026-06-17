type ConciergeToggleSession = {
  role: string
  tier: string | null | undefined
}

export class ConciergeToggleDeniedError extends Error {
  constructor(message = "Concierge toggle denied") {
    super(message)
    this.name = "ConciergeToggleDeniedError"
  }
}

export function resolveConciergeToggleResolvedRole(
  session: ConciergeToggleSession,
): string {
  const role = session.role.trim().toLowerCase()

  if (role === "admin" || role === "concierge" || role === "owner") {
    return role
  }

  const tier =
    typeof session.tier === "string" ? session.tier.trim().toLowerCase() : ""

  if (tier === "owner") {
    return "owner"
  }

  return role || "guest"
}

export function canToggleConciergeAvailability(
  session: ConciergeToggleSession,
): boolean {
  const resolved_role = resolveConciergeToggleResolvedRole(session)

  return (
    resolved_role === "admin" ||
    resolved_role === "owner" ||
    resolved_role === "concierge"
  )
}
