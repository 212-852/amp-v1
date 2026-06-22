import type { Session } from "@/core/auth/types"
import type { NotificationType } from "@/core/chat/types"
import { get_display_name } from "@/core/profile/display"
import { normalize_address_code } from "@/src/address/rules"

export type ProfileLocale = "ja" | "en" | "es"

export type ProfileSettingsPatch = {
  nickname?: string | null
  first_name?: string | null
  last_name?: string | null
  birth_date?: string | null
  phone?: string | null
  prefecture?: string | null
  city?: string | null
  prefecture_code?: string | null
  city_code?: string | null
  address?: string | null
  memo?: string | null
  language?: ProfileLocale
  locale?: ProfileLocale
  notification_type?: NotificationType
}

function read_address_field(
  body: Record<string, unknown>,
  canonical_key: "prefecture_code" | "city_code",
  alias_key: "prefecture" | "city",
) {
  if (canonical_key in body) {
    return body[canonical_key]
  }

  if (alias_key in body) {
    return body[alias_key]
  }

  return undefined
}

export function normalize_profile_locale(value: unknown): ProfileLocale | null {
  return value === "ja" || value === "en" || value === "es" ? value : null
}

export function normalize_notification_type(
  value: unknown,
): NotificationType | null {
  if (value === "line" || value === "pwa_push") {
    return value
  }

  return value === "push" ? "pwa_push" : null
}

function normalize_optional_string(value: unknown) {
  if (typeof value !== "string") {
    return undefined
  }

  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function normalize_birth_date(value: unknown) {
  const normalized = normalize_optional_string(value)

  if (!normalized) {
    return normalized
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new Error("Invalid birth date")
  }

  return normalized
}

export function resolve_profile_name(input: {
  nickname?: string | null
  first_name?: string | null
  last_name?: string | null
  users_name?: string | null
  display_name?: string | null
  fallback?: string | null
}) {
  return get_display_name(
    {
      nickname: input.nickname,
      first_name: input.first_name,
      last_name: input.last_name,
    },
    {
      name: input.users_name,
      display_name: input.display_name,
      fallback: input.fallback,
    },
  )
}

export function validate_profile_patch(
  body: Record<string, unknown>,
  _session: Session,
): ProfileSettingsPatch {
  void _session
  const patch: ProfileSettingsPatch = {}

  for (const key of [
    "nickname",
    "first_name",
    "last_name",
    "phone",
    "prefecture",
    "city",
    "address",
    "memo",
  ] as const) {
    if (key in body) {
      const value = normalize_optional_string(body[key])

      if (value !== undefined) {
        patch[key] = value
      }
    }
  }

  const prefecture_input = read_address_field(body, "prefecture_code", "prefecture")

  if (prefecture_input !== undefined) {
    const prefecture_code = normalize_address_code(prefecture_input)

    if (prefecture_code !== undefined) {
      patch.prefecture_code = prefecture_code
    }
  }

  const city_input = read_address_field(body, "city_code", "city")

  if (city_input !== undefined) {
    const city_code = normalize_address_code(city_input)

    if (city_code !== undefined) {
      patch.city_code = city_code
    }
  }

  if ("birth_date" in body) {
    const birth_date = normalize_birth_date(body.birth_date)

    if (birth_date !== undefined) {
      patch.birth_date = birth_date
    }
  }

  const language_input = "language" in body ? body.language : body.locale

  if (language_input !== undefined) {
    const locale = normalize_profile_locale(language_input)

    if (!locale) {
      throw new Error("Invalid language")
    }

    patch.language = locale
    patch.locale = locale
  }

  if ("notification_type" in body) {
    const notification_type = normalize_notification_type(body.notification_type)

    if (!notification_type) {
      throw new Error("Invalid notification_type")
    }

    patch.notification_type = notification_type
  }

  return patch
}
