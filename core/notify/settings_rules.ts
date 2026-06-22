import { canToggleConciergeAvailability } from "@/core/chat/concierge_access"
import type { NotificationType } from "@/core/chat/types"

export type NotificationHistoryKind =
  | "new_message"
  | "reservation_confirmed"
  | "reservation_changed"
  | "system"

export type NotificationHistoryRecord = {
  notification_uuid: string
  kind: NotificationHistoryKind
  title: string
  body?: string | null
  created_at: string
}

export type NotificationPageRulesInput = {
  role: string
  tier?: string | null
  availability_enabled: boolean
  notification_type: NotificationType
}

export type NotificationPageRules = {
  can_toggle_availability: boolean
  availability_enabled: boolean
  notification_type: NotificationType
}

export function resolveNotificationPageRules(
  input: NotificationPageRulesInput,
): NotificationPageRules {
  return {
    can_toggle_availability: canToggleConciergeAvailability({
      role: input.role,
      tier: input.tier ?? null,
    }),
    availability_enabled: input.availability_enabled,
    notification_type: input.notification_type,
  }
}

export function shouldShowAvailabilitySettings(rules: NotificationPageRules) {
  return rules.can_toggle_availability
}
