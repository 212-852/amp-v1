import type { Session } from "@/core/auth/types"

export type ConciergeQueueContext = {
  session: Session
  limit: number
}

export function normalize_concierge_queue_context(
  session: Session,
  options?: { limit?: number },
): ConciergeQueueContext {
  return {
    session,
    limit: options?.limit ?? 10,
  }
}
