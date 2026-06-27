import {
  normalize_ocr_result,
  type OcrRequestContext,
} from "@/core/ocr/context"
import { ensure_ocr_env_loaded } from "@/core/ocr/env"
import { parse_document } from "@/core/ocr/parse"
import {
  create_ocr_pipeline_tracker,
  type OcrPipelineStep,
} from "@/core/ocr/pipeline"
import { send_ocr_server_debug } from "@/core/ocr/server_debug"
import type { OcrDocumentType } from "@/core/ocr/rules"

export type OcrActionResult = {
  document_type: OcrDocumentType
  image_url: string
  parsed: Record<string, string>
  confidence: number
  warnings: string[]
  provider: string
  pipeline_steps: OcrPipelineStep[]
}

export async function run_ocr(context: OcrRequestContext): Promise<OcrActionResult> {
  ensure_ocr_env_loaded()

  const pipeline = create_ocr_pipeline_tracker([
    "OCR_CAPTURE_STARTED",
    "OCR_CAPTURE_COMPLETED",
    "OCR_ANALYZE_STARTED",
  ])

  try {
    pipeline.complete_step("OCR_PROVIDER_PRIMARY_STARTED")

    const parsed = await parse_document({
      document_type: context.input.document_type,
      image_url: context.input.image_url,
    })

    pipeline.complete_step("OCR_ANALYZE_COMPLETED")

    await send_ocr_server_debug("OCR_ANALYZE_COMPLETED", {
      document_type: context.input.document_type,
      provider: parsed.provider,
      confidence: parsed.confidence,
      warning_count: parsed.warnings.length,
    })

    const normalized = normalize_ocr_result(
      context.input.document_type,
      parsed.parsed,
    )

    pipeline.complete_step("OCR_NORMALIZE_COMPLETED")

    await send_ocr_server_debug("OCR_NORMALIZE_COMPLETED", {
      document_type: context.input.document_type,
      field_count: Object.keys(normalized).length,
    })

    return {
      document_type: context.input.document_type,
      image_url: context.input.image_url,
      parsed: normalized,
      confidence: parsed.confidence,
      warnings: parsed.warnings,
      provider: parsed.provider,
      pipeline_steps: pipeline.snapshot().completed_steps,
    }
  } catch (error) {
    const snapshot = pipeline.snapshot()
    const stop_reason =
      error instanceof Error ? error.message : "ocr_pipeline_failed"

    await send_ocr_server_debug("OCR_PIPELINE_STOPPED", {
      document_type: context.input.document_type,
      completed_steps: snapshot.completed_steps,
      next_expected_step: snapshot.next_expected_step,
      stop_reason,
    })

    throw error
  }
}
