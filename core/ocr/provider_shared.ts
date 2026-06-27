import type { OcrDocumentType, OcrParseResult } from "@/core/ocr/rules"
import { is_ocr_parse_readable } from "@/core/ocr/rules"

export const OCR_SYSTEM_PROMPT =
  "Read the supplied Japanese document. Return JSON with keys parsed, confidence, and warnings. parsed must be an object of strings, confidence must be from 0 to 1, and warnings must be an array of strings. Never infer a value that is not visible."

export const OCR_FIELD_PROMPTS: Record<OcrDocumentType, string> = {
  driver_license_front:
    "Extract license_name, license_address, license_birth_date, license_number, and license_expiration_date. Dates must use YYYY-MM-DD. The license number must contain digits only.",
  vehicle_inspection_certificate:
    "Extract all clearly labeled vehicle inspection certificate fields using stable snake_case keys.",
  black_plate:
    "Extract all clearly visible black license plate fields using stable snake_case keys.",
  safety_manager_document:
    "Extract all clearly labeled safety manager document fields using stable snake_case keys.",
}

export function read_json_object(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value) as unknown
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

export function normalize_provider_parse_result(
  content: string,
): OcrParseResult {
  const result = read_json_object(content)
  const parsed = result?.parsed
  const warnings = result?.warnings

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("OCR provider returned an invalid parsed result")
  }

  return {
    parsed: Object.fromEntries(
      Object.entries(parsed).flatMap(([key, value]) =>
        typeof value === "string" ? [[key, value]] : [],
      ),
    ),
    confidence:
      typeof result.confidence === "number"
        ? Math.min(1, Math.max(0, result.confidence))
        : 0,
    warnings: Array.isArray(warnings)
      ? warnings.filter((warning): warning is string => typeof warning === "string")
      : [],
  }
}

export function is_provider_result_unreadable(input: {
  document_type: OcrDocumentType
  result: OcrParseResult
}) {
  return !is_ocr_parse_readable({
    document_type: input.document_type,
    parsed: input.result.parsed,
    confidence: input.result.confidence,
  })
}
