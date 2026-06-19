import type { Session } from "@/core/auth/types"

export type ProfileLocale = "ja" | "en" | "es"
export type NotificationPreference = "all" | "mentions" | "none"

export type ProfileSettingsPatch = {
  display_name?: string | null
  image_url?: string | null
  locale?: ProfileLocale
  notification_preference?: NotificationPreference
  concierge_available?: boolean
}

export function normalize_profile_locale(value: unknown): ProfileLocale | null {
  return value === "ja" || value === "en" || value === "es" ? value : null
}

export function normalize_notification_preference(
  value: unknown,
): NotificationPreference | null {
  return value === "all" || value === "mentions" || value === "none"
    ? value
    : null
}

function normalize_optional_string(value: unknown) {
  if (typeof value !== "string") {
    return undefined
  }

  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

export function can_edit_concierge_availability(session: Session) {
  return (
    session.role === "admin" ||
    session.role === "concierge" ||
    session.role === "owner"
  )
}

export function validate_profile_patch(
  body: Record<string, unknown>,
  session: Session,
): ProfileSettingsPatch {
  const patch: ProfileSettingsPatch = {}

  if ("display_name" in body) {
    const display_name = normalize_optional_string(body.display_name)

    if (display_name !== undefined) {
      patch.display_name = display_name
    }
  }

  if ("image_url" in body) {
    const image_url = normalize_optional_string(body.image_url)

    if (image_url !== undefined) {
      patch.image_url = image_url
    }
  }

  if ("locale" in body) {
    const locale = normalize_profile_locale(body.locale)

    if (!locale) {
      throw new Error("Invalid locale")
    }

    patch.locale = locale
  }

  if ("notification_preference" in body) {
    const notification_preference = normalize_notification_preference(
      body.notification_preference,
    )

    if (!notification_preference) {
      throw new Error("Invalid notification preference")
    }

    patch.notification_preference = notification_preference
  }

  if ("concierge_available" in body) {
    if (!can_edit_concierge_availability(session)) {
      throw new Error("Concierge availability is not editable")
    }

    if (typeof body.concierge_available !== "boolean") {
      throw new Error("Invalid concierge availability")
    }

    patch.concierge_available = body.concierge_available
  }

  return patch
}
