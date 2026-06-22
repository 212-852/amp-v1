import type { Session } from "@/core/auth/types"
import { getConciergeAvailabilityState } from "@/core/chat/action"
import { getNotificationSettings } from "@/core/notify/preferences"
import type { NotificationHistoryRecord } from "@/core/notify/settings_rules"

export async function loadNotificationHistory(
  user_uuid: string | null,
): Promise<NotificationHistoryRecord[]> {
  if (!user_uuid) {
    return []
  }

  return []
}

export async function loadNotificationPageData(
  session: Pick<
    Session,
    "user_uuid" | "visitor_uuid" | "role" | "tier"
  >,
) {
  const [settings, availability, history] = await Promise.all([
    getNotificationSettings(session),
    getConciergeAvailabilityState(session),
    loadNotificationHistory(session.user_uuid),
  ])

  return {
    notification_type: settings.notification_type,
    availability_enabled: availability.enabled,
    history,
  }
}
