import type { NotificationType } from "@/core/chat/types"

export function buildPushKeyOutput(public_key: string) {
  return {
    ok: true,
    public_key,
  }
}

export function buildPushSubscribeOutput(input: {
  notification_type: NotificationType
  endpoint: string
}) {
  return {
    ok: true,
    notification_type: input.notification_type,
    endpoint: input.endpoint,
  }
}

