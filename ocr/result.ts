import type { OcrActionResult } from "@/ocr/type"

export function build_ocr_result(result: OcrActionResult) {
  return {
    ...result,
    message: result.ok
      ? "OCR読み込みが完了しました。"
      : "読み取りできませんでした。",
  }
}
