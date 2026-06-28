import type {
  NormalizedOcrInput,
  OcrDocumentType,
  OcrProvider,
  OcrProviderResult,
  OcrValidation,
} from "@/ocr/type"

export const guide_score_threshold = 0.9
export const edge_alignment_threshold = 0.85
export const required_valid_frames = 10
export const stable_required_ms = 2_200
export const auto_capture_delay_ms = 2_500

const DOCUMENT_TYPES = new Set<OcrDocumentType>([
  "driver_license_front",
  "vehicle_inspection_certificate",
  "black_plate",
  "safety_manager_document",
])

export const OCR_FIELD_PROMPTS: Record<OcrDocumentType, string> = {
  driver_license_front:
    "Extract name, address, birth_date, license_number, and expiration_date. Dates must be YYYY-MM-DD. license_number must contain digits only.",
  vehicle_inspection_certificate:
    "Extract visible vehicle inspection fields using stable snake_case keys.",
  black_plate:
    "Extract visible black license plate fields using stable snake_case keys.",
  safety_manager_document:
    "Extract visible safety manager certificate fields using stable snake_case keys.",
}

export const OCR_SYSTEM_PROMPT =
  "Read the Japanese document. Return JSON with fields, confidence, and warnings. fields must contain only visible values. Never infer missing data."

function read_provider(value: string | undefined, fallback: OcrProvider) {
  const normalized = value?.trim().toLowerCase()
  if (normalized === "gemini") return "gemini"
  if (normalized === "openai") return "openai"
  return fallback
}

export function decide_provider_order(
  input: NormalizedOcrInput,
): OcrProvider[] {
  const primary = input.provider_preference !== "default"
    ? input.provider_preference
    : read_provider(process.env.OCR_PRIMARY_PROVIDER, "openai")
  const configured_fallback = read_provider(
    process.env.OCR_FALLBACK_PROVIDER,
    "gemini",
  )
  const fallback = configured_fallback === primary
    ? primary === "openai" ? "gemini" : "openai"
    : configured_fallback

  return [primary, fallback]
}

export function validate_ocr_input(input: NormalizedOcrInput): OcrValidation {
  const errors: Record<string, string> = {}

  if (!DOCUMENT_TYPES.has(input.document_type)) {
    errors.document_type = "書類種別が不正です。"
  }

  if (!/^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(input.image_data_url)) {
    errors.image_base64 = "画像が必要です。"
  }

  return { valid: Object.keys(errors).length === 0, readable: false, errors }
}

export function validate_ocr_result(
  document_type: OcrDocumentType,
  result: OcrProviderResult,
): OcrValidation {
  const errors: Record<string, string> = {}
  const values = Object.values(result.fields).filter((value) => value.trim())

  if (values.length === 0) {
    errors.result = "読み取りできませんでした。"
  }

  if (document_type === "driver_license_front") {
    for (const field of [
      "name",
      "address",
      "birth_date",
      "license_number",
      "expiration_date",
    ]) {
      if (!result.fields[field]?.trim()) {
        errors[field] = "読み取り結果を確認してください。"
      }
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    readable: values.length > 0,
    errors,
  }
}

export function should_use_fallback(validation: OcrValidation) {
  return !validation.valid || !validation.readable
}
