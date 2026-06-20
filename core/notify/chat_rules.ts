import type { AvailabilityState, NotificationType } from "@/core/chat/types"

export type ChatNotifySenderRole =
  | "guest"
  | "user"
  | "admin"
  | "concierge"
  | "bot"
  | "system"

export type ChatNotifyReceiverRole =
  | "admin"
  | "concierge"
  | "driver"
  | "user"
  | "guest"
  | "bot"

export type ChatNotifyDecisionInput = {
  availability: AvailabilityState
  notification_type: NotificationType
  sender_role: ChatNotifySenderRole
  receiver_role: ChatNotifyReceiverRole
}

export type ChatNotifySkipReason =
  | "availability_off"
  | "invalid_sender"
  | null

export function resolveChatNotifyDecision(
  input: ChatNotifyDecisionInput,
): { should_notify: boolean; skip_reason: ChatNotifySkipReason } {
  if (input.availability !== "on") {
    return { should_notify: false, skip_reason: "availability_off" }
  }

  if (
    input.sender_role === "concierge" ||
    input.sender_role === "admin" ||
    input.sender_role === "bot" ||
    input.sender_role === "system"
  ) {
    return { should_notify: false, skip_reason: "invalid_sender" }
  }

  if (input.sender_role === "user" || input.sender_role === "guest") {
    return { should_notify: true, skip_reason: null }
  }

  return { should_notify: false, skip_reason: "invalid_sender" }
}

export function buildChatNotificationContent(input: {
  user_name: string
  room_uuid: string
}) {
  const app_base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? ""
  const room_path = `/admin/list/${encodeURIComponent(input.room_uuid)}`
  const room_url = app_base ? `${app_base}${room_path}` : room_path

  return {
    title: "New Message",
    body: `${input.user_name} sent a message.`,
    room_uuid: input.room_uuid,
    room_url,
  }
}
