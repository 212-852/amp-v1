import type { EntryLineIdentity } from "@/core/auth/identity"
import type { AuthContext } from "@/core/auth/types"
import type { Session } from "@/core/auth/types"

export type EntryFormInput = {
  name: string
  phone: string
  email: string
  prefecture_code: string
  city_code: string
  prefecture: string
  city: string
  address: string
  car_owned: string
  license_owned: string
  available_days: string
  note: string
}

export type EntryRequestContext = {
  auth: AuthContext
  session: Session
  line_identity: EntryLineIdentity
  input: EntryFormInput
}

function readString(body: Record<string, unknown>, key: string) {
  const value = body[key]

  return typeof value === "string" ? value.trim() : ""
}

export function build_entry_context(input: {
  auth: AuthContext
  session: Session
  line_identity: EntryLineIdentity
  body: Record<string, unknown>
}): EntryRequestContext {
  return {
    auth: input.auth,
    session: input.session,
    line_identity: input.line_identity,
    input: {
      name: readString(input.body, "name"),
      phone: readString(input.body, "phone"),
      email: readString(input.body, "email"),
      prefecture_code: readString(input.body, "prefecture_code"),
      city_code: readString(input.body, "city_code"),
      prefecture: readString(input.body, "prefecture"),
      city: readString(input.body, "city"),
      address: readString(input.body, "address"),
      car_owned: readString(input.body, "car_owned"),
      license_owned: readString(input.body, "license_owned"),
      available_days: readString(input.body, "available_days"),
      note: readString(input.body, "note"),
    },
  }
}
