import type { AvailabilityState } from "@/core/chat/types"

export type ChatNotificationContactType = "line" | "push"

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

export type ChatNotifySkipReason =
  | "availability_off"
  | "invalid_sender"
  | "receiver_in_room"
  | "receiver_active"
  | "contact_state_unknown"
  | "contact_receive_disabled"
  | "contact_missing"
  | "line_target_missing"
  | "push_target_missing"
  | null

export type ChatNotifyDeliveryKind =
  | "none"
  | "push"
  | "line"

export type ChatNotifyDecisionInput = {
  availability: AvailabilityState
  sender_role: ChatNotifySenderRole
  delivery: ChatNotifyDeliveryKind
}

export function resolveChatNotifyDecision(
  input: ChatNotifyDecisionInput,
): { should_deliver: boolean; skip_reason: ChatNotifySkipReason } {
  if (input.availability !== "on") {
    return { should_deliver: false, skip_reason: "availability_off" }
  }

  if (
    input.sender_role === "concierge" ||
    input.sender_role === "admin" ||
    input.sender_role === "bot" ||
    input.sender_role === "system"
  ) {
    return { should_deliver: false, skip_reason: "invalid_sender" }
  }

  if (input.sender_role !== "user" && input.sender_role !== "guest") {
    return { should_deliver: false, skip_reason: "invalid_sender" }
  }

  if (input.delivery === "none") {
    return { should_deliver: false, skip_reason: "contact_missing" }
  }

  return { should_deliver: true, skip_reason: null }
}

export function buildChatNotificationContent(input: {
  user_name: string
  room_uuid: string
}) {
  const { liff_url } = buildChatNotificationUrls()

  return {
    title: "コンシェルジュ対応が必要です",
    body: `${input.user_name}からコンシェルジュへの新着メッセージを受信しました`,
    room_uuid: input.room_uuid,
    room_url: liff_url,
  }
}

export const CHAT_NOTIFICATION_LIFF_URL =
  "https://liff.line.me/2006953406-vj2gYoAb"

export function buildChatNotificationUrls() {
  return {
    liff_url: CHAT_NOTIFICATION_LIFF_URL,
    line_liff_url: CHAT_NOTIFICATION_LIFF_URL,
    push_url: CHAT_NOTIFICATION_LIFF_URL,
  }
}
