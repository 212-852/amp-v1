import type { Session } from "@/core/auth/types"
import { normalize_address_code } from "@/src/address/rules"

export type ProfileLocale = "ja" | "en" | "es"

export type ProfileSettingsPatch = {
  nickname?: string | null
  first_name?: string | null
  last_name?: string | null
  birth_date?: string | null
  phone?: string | null
  prefecture_code?: string | null
  city_code?: string | null
  address?: string | null
  memo?: string | null
  locale?: ProfileLocale
}

export function normalize_profile_locale(value: unknown): ProfileLocale | null {
  return value === "ja" || value === "en" || value === "es" ? value : null
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

export function resolve_profile_display_name(input: {
  nickname?: string | null
  first_name?: string | null
  last_name?: string | null
  users_name?: string | null
  display_name?: string | null
  fallback?: string | null
}) {
  const nickname = input.nickname?.trim()
  const full_name = [input.first_name, input.last_name]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(" ")
  const users_name = input.users_name?.trim() || input.display_name?.trim()
  const fallback = input.fallback?.trim()

  return nickname || full_name || users_name || fallback || "Guest"
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

  if ("prefecture_code" in body) {
    const prefecture_code = normalize_address_code(body.prefecture_code)

    if (prefecture_code !== undefined) {
      patch.prefecture_code = prefecture_code
    }
  }

  if ("city_code" in body) {
    const city_code = normalize_address_code(body.city_code)

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

  if ("locale" in body) {
    const locale = normalize_profile_locale(body.locale)

    if (!locale) {
      throw new Error("Invalid locale")
    }

    patch.locale = locale
  }
  return patch
}
