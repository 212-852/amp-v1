import type { Session } from "@/core/auth/types"
import { loadNotificationPageData } from "@/core/notify/action"
import { buildNotificationPageOutput } from "@/core/notify/settings_output"

export async function resolveNotificationPageContext(input: {
  session: Pick<
    Session,
    "user_uuid" | "visitor_uuid" | "role" | "tier"
  >
  locale?: string | null
}) {
  const data = await loadNotificationPageData(input.session)

  return buildNotificationPageOutput({
    role: input.session.role,
    tier: input.session.tier,
    notification_type: data.notification_type,
    availability_enabled: data.availability_enabled,
    history: data.history,
    locale: input.locale ?? "ja",
  })
}
