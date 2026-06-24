import type {
  DriverFreightOperatorStatus,
  DriverPetExperience,
  DriverSafetyManagerStatus,
  DriverTransportExperience,
  DriverVehicleStatus,
  EntryFormInput,
  EntryProfileInput,
  EntryQuestionnaireInput,
} from "@/core/entry/context"

export type EntryValidationResult = {
  ok: boolean
  errors: Record<string, string>
}

const profile_required_fields: Array<keyof EntryProfileInput> = [
  "last_name",
  "first_name",
  "phone",
  "email",
  "prefecture_code",
  "city_code",
  "address",
]

const vehicle_status_values = new Set<DriverVehicleStatus>([
  "owned",
  "planned",
  "consult",
])

const freight_operator_status_values = new Set<DriverFreightOperatorStatus>([
  "obtained",
  "applying",
  "unknown",
  "consult",
])

const safety_manager_status_values = new Set<DriverSafetyManagerStatus>([
  "obtained",
  "planned",
  "unknown",
  "consult",
])

const pet_experience_values = new Set<DriverPetExperience>([
  "dog",
  "cat",
  "other",
  "none",
])

const transport_experience_values = new Set<DriverTransportExperience>([
  "yes",
  "no",
])

function validate_profile_input(profile: EntryProfileInput) {
  const errors: Record<string, string> = {}

  for (const field of profile_required_fields) {
    if (!profile[field]) {
      errors[field] = "required"
    }
  }

  if (profile.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) {
    errors.email = "invalid"
  }

  return errors
}

function validate_questionnaire_input(questionnaire: EntryQuestionnaireInput) {
  const errors: Record<string, string> = {}

  if (!questionnaire.has_driver_license) {
    errors.has_driver_license = "required"
  }

  if (!vehicle_status_values.has(questionnaire.vehicle)) {
    errors.vehicle = "required"
  }

  if (!freight_operator_status_values.has(questionnaire.freight_operator)) {
    errors.freight_operator = "required"
  }

  if (!safety_manager_status_values.has(questionnaire.safety_manager)) {
    errors.safety_manager = "required"
  }

  const pet_experience = questionnaire.pet_experience.filter((value) =>
    pet_experience_values.has(value),
  )

  if (pet_experience.length === 0) {
    errors.pet_experience = "required"
  } else if (
    pet_experience.includes("none") &&
    pet_experience.some((value) => value !== "none")
  ) {
    errors.pet_experience = "invalid"
  }

  if (!transport_experience_values.has(questionnaire.transport_experience)) {
    errors.transport_experience = "required"
  }

  if (!questionnaire.application_reason.trim()) {
    errors.application_reason = "required"
  }

  return errors
}

export function validate_entry_input(input: EntryFormInput): EntryValidationResult {
  const errors = {
    ...validate_profile_input(input.profile),
    ...validate_questionnaire_input(input.questionnaire),
  }

  return {
    ok: Object.keys(errors).length === 0,
    errors,
  }
}

export function normalize_pet_experience(values: DriverPetExperience[]) {
  const normalized = values.filter((value) => pet_experience_values.has(value))

  if (normalized.includes("none")) {
    return ["none"] as DriverPetExperience[]
  }

  return Array.from(new Set(normalized))
}

export const ENTRY_SUCCESS_REDIRECT_PATH = "/app"
