export const form_label_class = "grid gap-1.5 text-[13px] font-semibold text-[#5b422b]"

export const form_error_message_class = "text-[12px] font-medium leading-5 text-red-600"

export const form_field_error_state =
  "border-red-500 bg-[#fef2f2] focus:border-red-500 focus:ring-2 focus:ring-red-500/20"

export const ENTRY_PROFILE_FIELD_KEYS = [
  "last_name",
  "first_name",
  "phone",
  "email",
  "prefecture_code",
  "city_code",
  "address",
] as const

export type EntryProfileFieldKey = (typeof ENTRY_PROFILE_FIELD_KEYS)[number]

export function resolveFieldClass(
  baseClass: string,
  error?: string | null,
) {
  if (!error) {
    return baseClass
  }

  return `${baseClass} ${form_field_error_state}`
}

export function has_profile_field_errors(errors: Record<string, string>) {
  return ENTRY_PROFILE_FIELD_KEYS.some((key) => Boolean(errors[key]))
}

export function should_show_generic_form_message(
  errors: Record<string, string>,
  message: string | null,
) {
  if (!message) {
    return false
  }

  return !has_profile_field_errors(errors)
}
