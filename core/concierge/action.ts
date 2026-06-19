import type { Session } from "@/core/auth/types"
import { loadConciergeAvailability } from "@/core/chat/archive"
import {
  loadConciergeQueue,
  type ConciergeQueueItem,
} from "@/core/chat/concierge_queue"
import { canToggleConciergeAvailability } from "@/core/chat/concierge_access"
import { normalize_concierge_queue_context } from "@/core/concierge/context"
import {
  resolve_concierge_queue_room_condition,
  should_show_concierge_list,
} from "@/core/concierge/rules"

export type ConciergeQueueResult = {
  availability_enabled: boolean
  should_show_list: boolean
  room_condition: ReturnType<typeof resolve_concierge_queue_room_condition>
  rooms: ConciergeQueueItem[]
  items: ConciergeQueueItem[]
}

export async function get_concierge_queue(
  session: Session,
  options?: { limit?: number; mode?: "concierge" | "bot" },
): Promise<ConciergeQueueResult> {
  const context = normalize_concierge_queue_context(session, options)

  if (!canToggleConciergeAvailability(context.session)) {
    throw new Error("Concierge queue access denied")
  }

  const availability_enabled = await loadConciergeAvailability(
    context.session.user_uuid,
  )
  const should_show_list = should_show_concierge_list({
    availability_enabled,
  })
  const room_condition = resolve_concierge_queue_room_condition(
    options?.mode ?? "concierge",
  )

  if (!should_show_list) {
    return {
      availability_enabled,
      should_show_list,
      room_condition,
      rooms: [],
      items: [],
    }
  }

  const rooms = await loadConciergeQueue(context.session, {
    limit: context.limit,
    mode: room_condition.mode,
  })

  return {
    availability_enabled,
    should_show_list,
    room_condition,
    rooms,
    items: rooms,
  }
}
