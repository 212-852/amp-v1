export type OcrDocumentType =
  | "driver_license_front"
  | "vehicle_inspection_certificate"
  | "black_plate"
  | "safety_manager_document"

export type DriverLicenseParsedFields = {
  license_name: string
  license_address: string
  license_birth_date: string
  license_number: string
  license_expiration_date: string
}

export type OcrParsedFields = DriverLicenseParsedFields | Record<string, string>

export type OcrValidationResult = {
  ok: boolean
  errors: Record<string, string>
}

export type OcrParseResult = {
  parsed: Record<string, string>
  confidence: number
  warnings: string[]
}

export const OCR_DOCUMENT_TYPES: OcrDocumentType[] = [
  "driver_license_front",
  "vehicle_inspection_certificate",
  "black_plate",
  "safety_manager_document",
]

export const OCR_FRAME_ASPECT: Record<OcrDocumentType, number> = {
  driver_license_front: 1.586,
  vehicle_inspection_certificate: 1.414,
  black_plate: 2.0,
  safety_manager_document: 1.414,
}

export const OCR_GUIDANCE: Record<string, string> = {
  align_frame: "枠内に合わせてください",
  reduce_blur: "手ブレに注意してください",
  increase_light: "明るい場所で撮影してください",
  reduce_glare: "反射を避けてください",
  hold_steady: "そのままお待ちください",
  document_missing: "枠内に合わせてください",
}

export const OCR_AUTO_CAPTURE_STABLE_MS = 500
export const OCR_AUTO_CAPTURE_MIN_SCORE = 0.72
export const OCR_AUTO_SCAN_TIMEOUT_MS = 45_000

export function read_ocr_document_type(value: unknown): OcrDocumentType | null {
  if (
    value === "driver_license_front" ||
    value === "vehicle_inspection_certificate" ||
    value === "black_plate" ||
    value === "safety_manager_document"
  ) {
    return value
  }

  return null
}

export function validate_ocr_request(input: {
  document_type: OcrDocumentType | null
  image_url: string
}) {
  const errors: Record<string, string> = {}

  if (!input.document_type) {
    errors.document_type = "書類種別が不正です。"
  }

  if (!input.image_url.trim()) {
    errors.image_url = "画像が必要です。"
  }

  return {
    ok: Object.keys(errors).length === 0,
    errors,
  } satisfies OcrValidationResult
}

export function validate_license_save(input: {
  image_url: string
  license_name?: string
  license_address?: string
  license_birth_date?: string
  license_number?: string
  license_expiration_date?: string
}) {
  const errors: Record<string, string> = {}

  if (!input.image_url.trim()) {
    errors.image_url = "画像が必要です。"
  }

  if (!input.license_name?.trim()) {
    errors.license_name = "氏名が必要です。"
  }

  if (!input.license_address?.trim()) {
    errors.license_address = "住所が必要です。"
  }

  if (!input.license_birth_date?.trim()) {
    errors.license_birth_date = "生年月日が必要です。"
  }

  if (!input.license_number?.trim()) {
    errors.license_number = "免許証番号が必要です。"
  }

  if (!input.license_expiration_date?.trim()) {
    errors.license_expiration_date = "有効期限が必要です。"
  }

  return {
    ok: Object.keys(errors).length === 0,
    errors,
  } satisfies OcrValidationResult
}

export function resolve_guidance_message(guidance_key: string) {
  return OCR_GUIDANCE[guidance_key] ?? OCR_GUIDANCE.align_frame
}

export function compute_document_frame(input: {
  viewport_width: number
  viewport_height: number
  aspect_ratio: number
  padding_ratio?: number
}) {
  const padding = input.padding_ratio ?? 0.12
  const max_width = input.viewport_width * (1 - padding * 2)
  const max_height = input.viewport_height * (1 - padding * 2)

  let width = max_width
  let height = width / input.aspect_ratio

  if (height > max_height) {
    height = max_height
    width = height * input.aspect_ratio
  }

  return {
    x: (input.viewport_width - width) / 2,
    y: (input.viewport_height - height) / 2,
    width,
    height,
  }
}
