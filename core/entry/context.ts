import type { EntryLineIdentity } from "@/core/auth/identity"
import type { AuthContext, Session } from "@/core/auth/types"
import { normalize_entry_form_body } from "@/form/normalize"

export type EntryProfileInput = {
  last_name: string
  first_name: string
  phone: string
  email: string
  prefecture_code: string
  city_code: string
  prefecture: string
  city: string
  address: string
  memo: string
}

export type DriverVehicleStatus = "owned" | "planned" | "consult"

export type DriverFreightOperatorStatus =
  | "obtained"
  | "applying"
  | "unknown"
  | "consult"

export type DriverSafetyManagerStatus =
  | "obtained"
  | "planned"
  | "unknown"
  | "consult"

export type DriverPetExperience = "dog" | "cat" | "other" | "none"

export type DriverTransportExperience = "yes" | "no"

export type EntryQuestionnaireInput = {
  has_driver_license: boolean
  vehicle_status: DriverVehicleStatus
  freight_operator_status: DriverFreightOperatorStatus
  safety_manager_status: DriverSafetyManagerStatus
  pet_experience: DriverPetExperience[]
  transport_experience: DriverTransportExperience
  application_reason: string
}

export type EntryFormInput = {
  profile: EntryProfileInput
  questionnaire: EntryQuestionnaireInput
}

export type EntryRequestContext = {
  auth: AuthContext
  session: Session
  line_identity: EntryLineIdentity
  input: EntryFormInput
}

export type EntryFormInitialValues = {
  last_name: string
  first_name: string
  phone: string
  email: string
  prefecture_code: string
  city_code: string
  prefecture: string
  city: string
  address: string
  memo: string
}

function readString(body: Record<string, unknown>, key: string) {
  const value = body[key]

  return typeof value === "string" ? value.trim() : ""
}

function readBoolean(body: Record<string, unknown>, key: string) {
  const value = body[key]

  if (value === true || value === "true" || value === "1" || value === "on") {
    return true
  }

  return false
}

function readStringArray(body: Record<string, unknown>, key: string) {
  const value = body[key]

  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean)
  }

  if (typeof value === "string" && value.trim()) {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  }

  return []
}

export function build_entry_form_initial(input: {
  session: Session
  profile?: {
    last_name?: string | null
    first_name?: string | null
    phone?: string | null
    prefecture?: string | null
    city?: string | null
    prefecture_code?: string | null
    city_code?: string | null
    address?: string | null
    memo?: string | null
  } | null
}): EntryFormInitialValues {
  return {
    last_name: input.profile?.last_name?.trim() ?? "",
    first_name: input.profile?.first_name?.trim() ?? "",
    phone: input.profile?.phone?.trim() ?? "",
    email: input.session.email?.trim() ?? "",
    prefecture_code: input.profile?.prefecture_code?.trim() ?? "",
    city_code: input.profile?.city_code?.trim() ?? "",
    prefecture: input.profile?.prefecture?.trim() ?? "",
    city: input.profile?.city?.trim() ?? "",
    address: input.profile?.address?.trim() ?? "",
    memo: input.profile?.memo?.trim() ?? "",
  }
}

export function build_entry_context(input: {
  auth: AuthContext
  session: Session
  line_identity: EntryLineIdentity
  body: Record<string, unknown>
}): EntryRequestContext {
  const body = normalize_entry_form_body(input.body)

  return {
    auth: input.auth,
    session: input.session,
    line_identity: input.line_identity,
    input: {
      profile: {
        last_name: readString(body, "last_name"),
        first_name: readString(body, "first_name"),
        phone: readString(body, "phone"),
        email: readString(body, "email"),
        prefecture_code: readString(body, "prefecture_code"),
        city_code: readString(body, "city_code"),
        prefecture: readString(body, "prefecture"),
        city: readString(body, "city"),
        address: readString(body, "address"),
        memo: readString(body, "memo"),
      },
      questionnaire: {
        has_driver_license: readBoolean(body, "has_driver_license"),
        vehicle_status: readString(
          body,
          "vehicle_status",
        ) as EntryQuestionnaireInput["vehicle_status"],
        freight_operator_status: readString(
          body,
          "freight_operator_status",
        ) as EntryQuestionnaireInput["freight_operator_status"],
        safety_manager_status: readString(
          body,
          "safety_manager_status",
        ) as EntryQuestionnaireInput["safety_manager_status"],
        pet_experience: readStringArray(
          body,
          "pet_experience",
        ) as DriverPetExperience[],
        transport_experience: readString(
          body,
          "transport_experience",
        ) as EntryQuestionnaireInput["transport_experience"],
        application_reason: readString(body, "application_reason"),
      },
    },
  }
}
