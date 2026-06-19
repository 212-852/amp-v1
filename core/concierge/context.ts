import type { Session } from "@/core/auth/types"

export type ConciergeQueueContext = {
  session: Session
  limit: number
  strict_concierge: boolean
}

export function normalize_concierge_queue_context(
  session: Session,
  options?: { limit?: number; strict_concierge?: boolean },
): ConciergeQueueContext {
  return {
    session,
    limit: options?.limit ?? 10,
    strict_concierge:
      "strict_concierge" in (options ?? {})
        ? options?.strict_concierge === true
        : false,
  }
}
