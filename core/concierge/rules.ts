export type ConciergeQueueRoomCondition = {
  mode: "concierge"
}

export function should_show_concierge_list(input: {
  availability_enabled: boolean
}) {
  return input.availability_enabled === true
}

export function resolve_concierge_queue_room_condition(): ConciergeQueueRoomCondition {
  return { mode: "concierge" }
}

export function resolve_concierge_room_href(room_uuid: string) {
  return `/admin/concierge/${encodeURIComponent(room_uuid)}`
}
