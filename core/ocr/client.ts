import {
  empty_driver_license_fields,
  merge_driver_license_parsed_fields,
  type DriverLicenseParsedFields,
  type OcrDocumentType,
} from "@/core/ocr/rules"
import { send_ocr_debug } from "@/core/ocr/debug"

export type OcrImageSource = "camera_capture" | "image_upload"

export type ClientOcrReadInput = {
  document_type: OcrDocumentType
  image_url: string
  source: OcrImageSource
}

export type ClientOcrReadResult = {
  ok: boolean
  message: string
  parsed: DriverLicenseParsedFields
  confidence: number
  warnings: string[]
  saved?: boolean
  state?: unknown
  errors?: Record<string, string>
}

type OcrApiResponse = {
  ok?: boolean
  message?: string
  parsed?: Partial<DriverLicenseParsedFields>
  confidence?: number
  warnings?: string[]
  saved?: boolean
  state?: unknown
  errors?: Record<string, string>
}

export function has_ocr_license_result(input: {
  parsed: Partial<DriverLicenseParsedFields>
  confidence: number
}) {
  return (
    Boolean(input.parsed.license_name) ||
    Boolean(input.parsed.license_number) ||
    Boolean(input.parsed.license_address) ||
    input.confidence > 0
  )
}

export async function read_document_image(
  input: ClientOcrReadInput,
): Promise<ClientOcrReadResult> {
  const empty_parsed = empty_driver_license_fields()

  if (input.source === "image_upload") {
    void send_ocr_debug("OCR_IMAGE_SELECTED", {
      document_type: input.document_type,
      source: input.source,
    })
  }

  void send_ocr_debug("OCR_READ_STARTED", {
    document_type: input.document_type,
    source: input.source,
  })

  try {
    const response = await fetch("/api/ocr", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        document_type: input.document_type,
        image_url: input.image_url,
      }),
    })
    const result = (await response.json().catch(() => null)) as OcrApiResponse | null

    if (!response.ok || result?.ok !== true) {
      void send_ocr_debug("OCR_READ_FAILED", {
        document_type: input.document_type,
        source: input.source,
        message: result?.message ?? "ocr_read_failed",
      })

      return {
        ok: false,
        message: result?.message ?? "OCR読み込みに失敗しました。手入力してください。",
        parsed: empty_parsed,
        confidence: 0,
        warnings: result?.warnings ?? [],
      }
    }

    const parsed = merge_driver_license_parsed_fields(
      empty_parsed,
      result.parsed ?? {},
    )
    const confidence = result.confidence ?? 0
    const warnings = result.warnings ?? []

    void send_ocr_debug("OCR_READ_SUCCEEDED", {
      document_type: input.document_type,
      source: input.source,
      confidence,
      warning_count: warnings.length,
      has_result: has_ocr_license_result({ parsed, confidence }),
    })

    return {
      ok: true,
      message: result.message ?? "OCR読み込みが完了しました。",
      parsed,
      confidence,
      warnings,
    }
  } catch (error) {
    void send_ocr_debug("OCR_READ_FAILED", {
      document_type: input.document_type,
      source: input.source,
      message: error instanceof Error ? error.message : "ocr_read_failed",
    })

    return {
      ok: false,
      message: "OCR読み込みに失敗しました。手入力してください。",
      parsed: empty_parsed,
      confidence: 0,
      warnings: [],
    }
  }
}

export async function read_driver_license_image(
  input: ClientOcrReadInput,
): Promise<ClientOcrReadResult> {
  const empty_parsed = empty_driver_license_fields()

  if (input.source === "image_upload") {
    void send_ocr_debug("OCR_IMAGE_SELECTED", {
      document_type: input.document_type,
      source: input.source,
    })
  }

  void send_ocr_debug("OCR_READ_STARTED", {
    document_type: input.document_type,
    source: input.source,
  })

  try {
    const response = await fetch("/api/driver/license/ocr", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        document_type: input.document_type,
        image_url: input.image_url,
        source: input.source,
      }),
    })
    const result = (await response.json().catch(() => null)) as OcrApiResponse | null

    if (!response.ok || result?.ok !== true) {
      void send_ocr_debug("OCR_READ_FAILED", {
        document_type: input.document_type,
        source: input.source,
        message: result?.message ?? "ocr_read_failed",
      })

      return {
        ok: false,
        message: result?.message ?? "OCR読み込みに失敗しました。手入力してください。",
        parsed: empty_parsed,
        confidence: 0,
        warnings: result?.warnings ?? [],
        saved: false,
        errors: result?.errors ?? {},
      }
    }

    const parsed = merge_driver_license_parsed_fields(
      empty_parsed,
      result.parsed ?? {},
    )
    const confidence = result.confidence ?? 0
    const warnings = result.warnings ?? []

    void send_ocr_debug("OCR_READ_SUCCEEDED", {
      document_type: input.document_type,
      source: input.source,
      confidence,
      warning_count: warnings.length,
      has_result: has_ocr_license_result({ parsed, confidence }),
      saved: result.saved === true,
    })

    return {
      ok: true,
      message: result.message ?? "OCR読み込みが完了しました。",
      parsed,
      confidence,
      warnings,
      saved: result.saved === true,
      state: result.state,
      errors: result.errors ?? {},
    }
  } catch (error) {
    void send_ocr_debug("OCR_READ_FAILED", {
      document_type: input.document_type,
      source: input.source,
      message: error instanceof Error ? error.message : "ocr_read_failed",
    })

    return {
      ok: false,
      message: "OCR読み込みに失敗しました。手入力してください。",
      parsed: empty_parsed,
      confidence: 0,
      warnings: [],
      saved: false,
      errors: {},
    }
  }
}

export function apply_ocr_to_license_form(input: {
  current: DriverLicenseParsedFields
  parsed: Partial<DriverLicenseParsedFields>
}) {
  const next_form = merge_driver_license_parsed_fields(input.current, input.parsed)
  const target_fields = [
    "license_name",
    "license_address",
    "license_birth_date",
    "license_number",
    "license_expiration_date",
  ]

  console.log("[OCR_FLOW] autofill_start", {
    parsed_ocr_result: input.parsed,
    target_form_field_names: target_fields,
  })

  void send_ocr_debug("OCR_FORM_FILLED", {
    has_license_name: Boolean(next_form.license_name),
    has_license_address: Boolean(next_form.license_address),
    has_license_birth_date: Boolean(next_form.license_birth_date),
    has_license_number: Boolean(next_form.license_number),
    has_license_expiration_date: Boolean(next_form.license_expiration_date),
  })

  console.log("[OCR_FLOW] autofill_success", {
    normalized_result: next_form,
    target_form_field_names: target_fields,
  })

  return next_form
}
