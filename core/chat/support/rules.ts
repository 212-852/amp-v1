import type { SessionRole, SessionTier } from "@/core/auth/types"

export type ChatSupportAccessReason = "member_required" | null

export type ChatSupportContext = {
  user_uuid: string | null
  role: SessionRole
  tier: SessionTier
}

export type ChatSupportAccess = {
  bot: {
    enabled: true
  }
  concierge: {
    enabled: boolean
    reason: ChatSupportAccessReason
  }
}

const MEMBER_OR_HIGHER_TIERS = new Set<string>([
  "member",
  "vip",
  "trainee",
  "active",
  "admin",
  "owner",
])

function hasLinkedAccount(context: ChatSupportContext) {
  return Boolean(context.user_uuid)
}

function hasMemberTierOrHigher(tier: SessionTier) {
  const normalized =
    typeof tier === "string" && tier.trim() ? tier.trim().toLowerCase() : "guest"

  return MEMBER_OR_HIGHER_TIERS.has(normalized)
}

function isConciergeRole(role: SessionRole) {
  return role === "admin" || role === "driver"
}

export function resolveChatSupportAccess(
  context: ChatSupportContext,
): ChatSupportAccess {
  const bot = { enabled: true as const }

  if (isConciergeRole(context.role)) {
    return {
      bot,
      concierge: {
        enabled: true,
        reason: null,
      },
    }
  }

  if (!hasLinkedAccount(context) || context.role === "guest") {
    return {
      bot,
      concierge: {
        enabled: false,
        reason: "member_required",
      },
    }
  }

  if (hasMemberTierOrHigher(context.tier)) {
    return {
      bot,
      concierge: {
        enabled: true,
        reason: null,
      },
    }
  }

  return {
    bot,
    concierge: {
      enabled: false,
      reason: "member_required",
    },
  }
}
