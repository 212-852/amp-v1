import { getConciergeAvailabilityState } from "@/core/chat/action"
import { get_concierge_queue } from "@/core/concierge/action"
import type { ConciergeQueueResult } from "@/core/concierge/action"
import type { Session } from "@/core/auth/types"
import { sendAuthDebug } from "@/core/debug"

export const ADMIN_HOME_QUEUE_LIMIT = 5

const EMPTY_QUEUE: ConciergeQueueResult = {
  availability_enabled: false,
  should_show_list: false,
  room_condition: { mode: "concierge" },
  rooms: [],
  items: [],
}

export async function resolveAdminHomeQueue(
  session: Session,
): Promise<ConciergeQueueResult> {
  try {
    const availability = await getConciergeAvailabilityState(session)
    const should_show_waiting_list = availability.enabled === true

    await sendAuthDebug("admin_top_availability_resolved", {
      availability: availability.enabled,
      should_show_waiting_list,
      user_uuid: session.user_uuid ?? null,
    })

    if (!should_show_waiting_list) {
      return EMPTY_QUEUE
    }

    return await get_concierge_queue(session, {
      limit: ADMIN_HOME_QUEUE_LIMIT,
      mode: "concierge",
      strict_concierge: true,
    })
  } catch (error) {
    await sendAuthDebug("admin_top_availability_resolved", {
      availability: false,
      should_show_waiting_list: false,
      user_uuid: session.user_uuid ?? null,
      error_message: error instanceof Error ? error.message : String(error),
    })

    return EMPTY_QUEUE
  }
}

export async function resolveAdminListQueue(
  session: Session,
): Promise<ConciergeQueueResult> {
  try {
    const availability = await getConciergeAvailabilityState(session)

    if (!availability.enabled) {
      return EMPTY_QUEUE
    }

    return await get_concierge_queue(session, {
      limit: 50,
      mode: "concierge",
    })
  } catch {
    return EMPTY_QUEUE
  }
}
