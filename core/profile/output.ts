import type { Session } from "@/core/auth/types"
import type {
  NotificationPreference,
  ProfileLocale,
} from "@/core/profile/rules"

export type ProfileDisplayPayload = {
  user_uuid: string | null
  visitor_uuid: string | null
  display_name: string
  image_url: string | null
  role: string
  tier: string | null
  locale: ProfileLocale
  notification_preference: NotificationPreference
  concierge_available?: boolean
}

function resolve_display_name(input: {
  display_name?: string | null
  session: Session
}) {
  return (
    input.display_name?.trim() ||
    input.session.display_name?.trim() ||
    (input.session.user_uuid ? input.session.role : "Guest")
  )
}

export function build_profile_output(input: {
  session: Session
  display_name?: string | null
  image_url?: string | null
  locale?: ProfileLocale | null
  notification_preference?: NotificationPreference | null
  concierge_available?: boolean
}): ProfileDisplayPayload {
  return {
    user_uuid: input.session.user_uuid,
    visitor_uuid: input.session.visitor_uuid,
    display_name: resolve_display_name(input),
    image_url: input.image_url ?? input.session.image_url ?? null,
    role: input.session.role,
    tier: input.session.tier ?? null,
    locale: input.locale ?? "ja",
    notification_preference: input.notification_preference ?? "all",
    concierge_available: input.concierge_available,
  }
}
