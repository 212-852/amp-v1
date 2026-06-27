import type { OcrActionResult } from "@/core/ocr/action"
import type { OcrValidationResult } from "@/core/ocr/rules"

export type OcrOutput = {
  ok: boolean
  message: string
  document_type?: OcrActionResult["document_type"]
  image_url?: string
  parsed?: Record<string, string>
  confidence?: number
  warnings?: string[]
  errors?: Record<string, string>
  pipeline_steps?: OcrActionResult["pipeline_steps"]
  pipeline_stopped_at?: string | null
  pipeline_stop_reason?: string | null
}

export function build_ocr_validation_output(
  validation: OcrValidationResult,
): OcrOutput {
  return {
    ok: false,
    message: "入力内容を確認してください。",
    errors: validation.errors,
  }
}

export function build_ocr_access_denied_output(reason: string): OcrOutput {
  return {
    ok: false,
    message:
      reason === "login_required"
        ? "ログインが必要です。"
        : "ドライバー権限が必要です。",
  }
}

export function build_ocr_success_output(result: OcrActionResult): OcrOutput {
  return {
    ok: true,
    message: "OCR読み込みが完了しました。",
    document_type: result.document_type,
    image_url: result.image_url,
    parsed: result.parsed,
    confidence: result.confidence,
    warnings: result.warnings,
    pipeline_steps: result.pipeline_steps,
  }
}
