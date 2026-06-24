import {
  empty_driver_license_fields,
  normalize_driver_license_fields,
  type OcrDocumentType,
  type OcrParseResult,
} from "@/core/ocr/rules"

async function parse_driver_license_front(
  _image_url: string,
): Promise<OcrParseResult> {
  void _image_url

  return {
    parsed: empty_driver_license_fields(),
    confidence: 0,
    warnings: ["OCR provider is not configured. Enter fields manually."],
  }
}

async function parse_vehicle_inspection_certificate(
  _image_url: string,
): Promise<OcrParseResult> {
  void _image_url

  return {
    parsed: {},
    confidence: 0,
    warnings: ["Vehicle inspection OCR is not configured yet."],
  }
}

async function parse_black_plate(_image_url: string): Promise<OcrParseResult> {
  void _image_url

  return {
    parsed: {},
    confidence: 0,
    warnings: ["Black plate OCR is not configured yet."],
  }
}

async function parse_safety_manager_document(
  _image_url: string,
): Promise<OcrParseResult> {
  void _image_url

  return {
    parsed: {},
    confidence: 0,
    warnings: ["Safety manager document OCR is not configured yet."],
  }
}

export async function parse_document(input: {
  document_type: OcrDocumentType
  image_url: string
}): Promise<OcrParseResult> {
  let result: OcrParseResult

  switch (input.document_type) {
    case "driver_license_front":
      result = await parse_driver_license_front(input.image_url)
      break
    case "vehicle_inspection_certificate":
      result = await parse_vehicle_inspection_certificate(input.image_url)
      break
    case "black_plate":
      result = await parse_black_plate(input.image_url)
      break
    case "safety_manager_document":
      result = await parse_safety_manager_document(input.image_url)
      break
    default:
      result = {
        parsed: {},
        confidence: 0,
        warnings: ["Unsupported document type."],
      }
  }

  if (input.document_type === "driver_license_front") {
    return {
      ...result,
      parsed: normalize_driver_license_fields(result.parsed),
    }
  }

  return result
}
