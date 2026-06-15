import type { SourceChannel } from "@/core/auth/types"
import type { AccessContext, AccessState } from "@/core/access/context"

export const ACCESS_ONLINE_WINDOW_MS = 60 * 1000

export type AccessRecord = {
  visitor_uuid: string
  user_uuid: string | null
  source_channel: SourceChannel
  state: AccessState
  receive: boolean
  last_seen_at: string | null
}

export function isAccessOnline(
  access: Pick<AccessRecord, "last_seen_at" | "state"> | null,
  now: Date = new Date(),
) {
  if (!access?.last_seen_at || access.state !== "active") {
    return false
  }

  const lastSeen = Date.parse(access.last_seen_at)

  return Number.isFinite(lastSeen) && now.getTime() - lastSeen <= ACCESS_ONLINE_WINDOW_MS
}

export function assertAccessContext(context: AccessContext) {
  if (!context.visitor_uuid) {
    throw new Error("Access context requires visitor_uuid")
  }
}
