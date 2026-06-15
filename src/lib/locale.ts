export type Locale = "ja" | "en" | "es"

const locale_storage_key = "amp_locale"

export const default_locale: Locale = "ja"

export function normalize_locale(value: unknown): Locale {
  if (typeof value !== "string") {
    return default_locale
  }

  const normalized_value = value.toLowerCase()

  if (normalized_value === "ja" || normalized_value === "ja-jp") {
    return "ja"
  }

  if (normalized_value === "es" || normalized_value.startsWith("es-")) {
    return "es"
  }

  if (normalized_value === "en" || normalized_value.startsWith("en-")) {
    return "en"
  }

  return "en"
}

export function get_browser_locale(): Locale {
  if (typeof window === "undefined") {
    return default_locale
  }

  return normalize_locale(window.navigator.language)
}

export function get_stored_locale(): Locale | null {
  if (typeof window === "undefined") {
    return null
  }

  const stored_locale = window.localStorage.getItem(locale_storage_key)

  if (!stored_locale) {
    return null
  }

  return normalize_locale(stored_locale)
}

export function save_locale(locale: Locale): void {
  if (typeof window === "undefined") {
    return
  }

  window.localStorage.setItem(locale_storage_key, locale)
}
