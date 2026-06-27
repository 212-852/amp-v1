import { empty_driver_license_fields } from "@/core/ocr/context"
import type { OcrDocumentType, OcrParseResult } from "@/core/ocr/rules"

const OCR_FIELD_PROMPTS: Record<OcrDocumentType, string> = {
  driver_license_front:
    "Extract license_name, license_address, license_birth_date, license_number, and license_expiration_date. Dates must use YYYY-MM-DD. The license number must contain digits only.",
  vehicle_inspection_certificate:
    "Extract all clearly labeled vehicle inspection certificate fields using stable snake_case keys.",
  black_plate:
    "Extract all clearly visible black license plate fields using stable snake_case keys.",
  safety_manager_document:
    "Extract all clearly labeled safety manager document fields using stable snake_case keys.",
}

function read_json_object(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value) as unknown
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

async function analyze_with_configured_provider(input: {
  document_type: OcrDocumentType
  image_url: string
}): Promise<OcrParseResult | null> {
  const api_key = process.env.OPENAI_API_KEY?.trim()

  if (!api_key) {
    return null
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${api_key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_OCR_MODEL ?? "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Read the supplied Japanese document. Return JSON with keys parsed, confidence, and warnings. parsed must be an object of strings, confidence must be from 0 to 1, and warnings must be an array of strings. Never infer a value that is not visible.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: OCR_FIELD_PROMPTS[input.document_type],
            },
            {
              type: "image_url",
              image_url: { url: input.image_url, detail: "high" },
            },
          ],
        },
      ],
    }),
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error(`OCR provider request failed (${response.status})`)
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>
  }
  const content = payload.choices?.[0]?.message?.content?.trim() ?? ""
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

async function parse_driver_license_front(
  image_url: string,
): Promise<OcrParseResult> {
  const provider_result = await analyze_with_configured_provider({
    document_type: "driver_license_front",
    image_url,
  })

  if (provider_result) {
    return provider_result
  }

  return {
    parsed: empty_driver_license_fields(),
    confidence: 0,
    warnings: ["OCR provider is not configured. Configure OPENAI_API_KEY."],
  }
}

async function parse_vehicle_inspection_certificate(
  image_url: string,
): Promise<OcrParseResult> {
  const provider_result = await analyze_with_configured_provider({
    document_type: "vehicle_inspection_certificate",
    image_url,
  })

  if (provider_result) {
    return provider_result
  }

  return {
    parsed: {},
    confidence: 0,
    warnings: ["Vehicle inspection OCR is not configured yet."],
  }
}

async function parse_black_plate(_image_url: string): Promise<OcrParseResult> {
  const provider_result = await analyze_with_configured_provider({
    document_type: "black_plate",
    image_url: _image_url,
  })

  if (provider_result) {
    return provider_result
  }

  return {
    parsed: {},
    confidence: 0,
    warnings: ["Black plate OCR is not configured yet."],
  }
}

async function parse_safety_manager_document(
  image_url: string,
): Promise<OcrParseResult> {
  const provider_result = await analyze_with_configured_provider({
    document_type: "safety_manager_document",
    image_url,
  })

  if (provider_result) {
    return provider_result
  }

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

  return result
}
