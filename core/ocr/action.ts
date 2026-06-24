import type { OcrRequestContext } from "@/core/ocr/context"
import { parse_document } from "@/core/ocr/parser"
import type { OcrDocumentType } from "@/core/ocr/rules"

export type OcrActionResult = {
  document_type: OcrDocumentType
  image_url: string
  parsed: Record<string, string>
  confidence: number
  warnings: string[]
}

export async function run_ocr(context: OcrRequestContext): Promise<OcrActionResult> {
  const parsed = await parse_document({
    document_type: context.input.document_type,
    image_url: context.input.image_url,
  })

  return {
    document_type: context.input.document_type,
    image_url: context.input.image_url,
    parsed: parsed.parsed,
    confidence: parsed.confidence,
    warnings: parsed.warnings,
  }
}
