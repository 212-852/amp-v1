export type OcrDocumentType = "driver_license_front"

export type DriverLicenseOcrFields = {
  license_name: string
  license_address: string
  license_birth_date: string
  license_number: string
  license_expiration_date: string
}

export type OcrValidationResult = {
  ok: boolean
  errors: Record<string, string>
}

export const OCR_DOCUMENT_TYPES: OcrDocumentType[] = ["driver_license_front"]

export function read_ocr_document_type(value: unknown): OcrDocumentType | null {
  if (value === "driver_license_front") {
    return value
  }

  return null
}

export function empty_driver_license_ocr_fields(): DriverLicenseOcrFields {
  return {
    license_name: "",
    license_address: "",
    license_birth_date: "",
    license_number: "",
    license_expiration_date: "",
  }
}

export function normalize_driver_license_ocr_fields(
  value: unknown,
): DriverLicenseOcrFields {
  const empty = empty_driver_license_ocr_fields()

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return empty
  }

  const record = value as Record<string, unknown>

  return {
    license_name:
      typeof record.license_name === "string" ? record.license_name.trim() : "",
    license_address:
      typeof record.license_address === "string"
        ? record.license_address.trim()
        : "",
    license_birth_date:
      typeof record.license_birth_date === "string"
        ? record.license_birth_date.trim()
        : "",
    license_number:
      typeof record.license_number === "string"
        ? record.license_number.trim()
        : "",
    license_expiration_date:
      typeof record.license_expiration_date === "string"
        ? record.license_expiration_date.trim()
        : "",
  }
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

export function build_ocr_status_label(input: {
  has_image: boolean
  has_result: boolean
  is_loading: boolean
}) {
  if (input.is_loading) {
    return "読み込み中..."
  }

  if (!input.has_image) {
    return "読み込み前"
  }

  if (!input.has_result) {
    return "読み込み結果なし（手入力してください）"
  }

  return "読み込み完了"
}
