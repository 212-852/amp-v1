export type AmpLocale = "ja" | "en" | "es"

const locale_storage_key = "amp_locale"

export function normalize_locale(value: unknown): AmpLocale {
  if (typeof value !== "string") {
    return "ja"
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

export function get_initial_locale(): AmpLocale {
  if (typeof window === "undefined") {
    return "ja"
  }

  const saved_locale = window.localStorage.getItem(locale_storage_key)

  if (saved_locale) {
    return normalize_locale(saved_locale)
  }

  return normalize_locale(window.navigator.language)
}

export function save_locale(locale: AmpLocale) {
  if (typeof window === "undefined") {
    return
  }

  window.localStorage.setItem(locale_storage_key, locale)
}
