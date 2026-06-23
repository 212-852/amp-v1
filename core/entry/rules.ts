import type { EntryFormInput } from "@/core/entry/context"
import { ADDRESS_OPTIONS } from "@/src/address/options"
import { validate_address_selection } from "@/src/address/rules"

export type EntryValidationResult = {
  ok: boolean
  errors: Record<string, string>
}

const required_fields: Array<keyof EntryFormInput> = [
  "name",
  "phone",
  "email",
  "prefecture_code",
  "city_code",
  "address",
  "car_owned",
  "license_owned",
  "available_days",
]

export function validate_entry_input(input: EntryFormInput): EntryValidationResult {
  const errors: Record<string, string> = {}

  for (const field of required_fields) {
    if (!input[field]) {
      errors[field] = "required"
    }
  }

  if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
    errors.email = "invalid"
  }

  if (input.car_owned !== "yes" && input.car_owned !== "no") {
    errors.car_owned = "invalid"
  }

  if (input.license_owned !== "yes" && input.license_owned !== "no") {
    errors.license_owned = "invalid"
  }

  try {
    validate_address_selection(ADDRESS_OPTIONS, {
      prefecture_code: input.prefecture_code,
      city_code: input.city_code,
    })
  } catch {
    if (input.prefecture_code) {
      errors.prefecture_code = "invalid"
    }

    if (input.city_code) {
      errors.city_code = "invalid"
    }
  }

  return {
    ok: Object.keys(errors).length === 0,
    errors,
  }
}

export function resolve_entry_redirect_path(role: string) {
  return role === "driver" ? "/driver" : "/app"
}
