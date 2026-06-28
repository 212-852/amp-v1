import "server-only"

import {
  normalize_number,
  normalize_text,
  normalize_textarea,
} from "@/form/normalize"
import type {
  NormalizedOcrInput,
  OcrDocumentType,
  OcrFields,
  OcrInput,
  OcrProviderResult,
} from "@/ocr/type"

function create_request_id() {
  return crypto.randomUUID()
}

async function blob_to_data_url(blob: Blob) {
  const bytes = Buffer.from(await blob.arrayBuffer())
  const mime_type = blob.type || "image/jpeg"
  return `data:${mime_type};base64,${bytes.toString("base64")}`
}

function normalize_image_base64(value: string | null | undefined) {
  const image = value?.trim() ?? ""

  if (!image) {
    return ""
  }

  return image.startsWith("data:")
    ? image
    : `data:image/jpeg;base64,${image}`
}

export async function normalize_ocr_input(
  input: OcrInput,
): Promise<NormalizedOcrInput> {
  const image_data_url = input.image_blob
    ? await blob_to_data_url(input.image_blob)
    : normalize_image_base64(input.image_base64)

  return {
    document_type: input.document_type,
    image_data_url,
    provider_preference: input.provider_preference ?? "default",
    request_id: input.request_id?.trim() || create_request_id(),
    component_instance_id: input.component_instance_id?.trim() || "server",
  }
}

function normalize_driver_license_fields(fields: OcrFields): OcrFields {
  return {
    name: normalize_text(fields.name ?? fields.license_name),
    address: normalize_textarea(fields.address ?? fields.license_address),
    birth_date: normalize_text(fields.birth_date ?? fields.license_birth_date),
    license_number: normalize_number(fields.license_number),
    expiration_date: normalize_text(
      fields.expiration_date ?? fields.license_expiration_date,
    ),
  }
}

export function normalize_ocr_raw_result(
  document_type: OcrDocumentType,
  result: OcrProviderResult,
): OcrProviderResult {
  const fields = document_type === "driver_license_front"
    ? normalize_driver_license_fields(result.fields)
    : Object.fromEntries(
        Object.entries(result.fields).flatMap(([key, value]) => {
          const normalized = normalize_text(value)
          return normalized ? [[key, normalized]] : []
        }),
      )

  return {
    fields,
    confidence: Math.min(1, Math.max(0, result.confidence)),
    warnings: result.warnings.filter(Boolean),
  }
}
