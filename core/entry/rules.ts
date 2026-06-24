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

  if (!profile.last_name) {
    errors.last_name = "姓を入力してください"
  }

  if (!profile.first_name) {
    errors.first_name = "名を入力してください"
  }

  if (!profile.phone) {
    errors.phone = "電話番号を入力してください"
  }

  if (!profile.email) {
    errors.email = "メールアドレスを入力してください"
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) {
    errors.email = "メールアドレスの形式が正しくありません"
  }

  if (!profile.prefecture_code) {
    errors.prefecture_code = "都道府県を選択してください"
  }

  if (!profile.city_code) {
    errors.city_code = "市区町村を選択してください"
  }

  if (!profile.address) {
    errors.address = "住所を入力してください"
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
