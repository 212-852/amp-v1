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

export type ChatNotifyDecisionInput = {
  availability: AvailabilityState
  sender_role: ChatNotifySenderRole
  receiver_role: ChatNotifyReceiverRole
  receiver_active: boolean
  contact_type: ChatNotificationContactType | null
}

export type ChatNotifySkipReason =
  | "availability_off"
  | "invalid_sender"
  | "receiver_active"
  | "missing_contact"
  | null

export function resolveChatNotifyDecision(
  input: ChatNotifyDecisionInput,
): { should_notify: boolean; skip_reason: ChatNotifySkipReason } {
  if (input.availability !== "on") {
    return { should_notify: false, skip_reason: "availability_off" }
  }

  if (input.receiver_active) {
    return { should_notify: false, skip_reason: "receiver_active" }
  }

  if (!input.contact_type) {
    return { should_notify: false, skip_reason: "missing_contact" }
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
  const { push_url } = buildChatNotificationUrls({
    room_uuid: input.room_uuid,
  })

  return {
    title: "New Message",
    body: `${input.user_name} sent a message.`,
    room_uuid: input.room_uuid,
    room_url: push_url,
  }
}

export function buildChatNotificationUrls(input: { room_uuid: string }) {
  const app_base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "https://app.da-nya.com"
  const liff_id =
    process.env.LIFF_ID?.trim() ??
    process.env.NEXT_PUBLIC_LIFF_ID?.trim() ??
    "2006953406-vj2gYoAb"
  const room_path = `/admin/list/${encodeURIComponent(input.room_uuid)}`
  const push_url = `${app_base}${room_path}`
  const query = new URLSearchParams({
    room_uuid: input.room_uuid,
    redirect: room_path,
  })
  const line_liff_url = `https://liff.line.me/${encodeURIComponent(
    liff_id,
  )}?${query.toString()}`

  return {
    line_liff_url,
    push_url,
  }
}
