import NotificationScreen from "@/components/notification/screen"
import { resolveNotificationPageContext } from "@/core/notify/context"
import type { Session } from "@/core/auth/types"

type NotificationPageViewProps = {
  session: Pick<Session, "user_uuid" | "visitor_uuid" | "role" | "tier">
  locale?: string | null
}

export default async function NotificationPageView({
  session,
  locale,
}: Readonly<NotificationPageViewProps>) {
  const page = await resolveNotificationPageContext({
    session,
    locale: locale ?? "ja",
  })

  return (
    <div className="mx-auto w-full max-w-[720px] px-4 py-6">
      <NotificationScreen
        initial_state={{
          notification_type: page.notification_type,
          availability: page.availability,
          history: page.history,
        }}
      />
    </div>
  )
}
