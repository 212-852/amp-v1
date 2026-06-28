import "server-only"

import { normalize_ocr_input, normalize_ocr_raw_result } from "@/ocr/context"
import { run_gemini_ocr } from "@/ocr/provider/gemini"
import { run_openai_ocr } from "@/ocr/provider/openai"
import {
  decide_provider_order,
  should_use_fallback,
  validate_ocr_input,
  validate_ocr_result,
} from "@/ocr/rules"
import type {
  OcrActionResult,
  OcrInput,
  OcrProvider,
  OcrProviderRequest,
} from "@/ocr/type"
import { send_ocr_server_debug } from "@/core/ocr/server_debug"

async function call_provider(provider: OcrProvider, input: OcrProviderRequest) {
  return provider === "openai" ? run_openai_ocr(input) : run_gemini_ocr(input)
}

function debug_payload(input: OcrProviderRequest, provider?: OcrProvider) {
  return {
    request_id: input.request_id,
    component_instance_id: input.component_instance_id,
    document_type: input.document_type,
    scan_state: "analyzing",
    camera_state: "captured",
    provider: provider ?? null,
  }
}

export async function run_ocr_action(input: OcrInput): Promise<OcrActionResult> {
  const normalized_input = await normalize_ocr_input(input)
  const input_validation = validate_ocr_input(normalized_input)

  if (!input_validation.valid) {
    return {
      ok: false,
      request_id: normalized_input.request_id,
      document_type: normalized_input.document_type,
      provider: null,
      fields: {},
      confidence: 0,
      warnings: [],
      errors: input_validation.errors,
    }
  }

  const request: OcrProviderRequest = {
    document_type: normalized_input.document_type,
    image_data_url: normalized_input.image_data_url,
    request_id: normalized_input.request_id,
    component_instance_id: normalized_input.component_instance_id,
  }
  const providers = decide_provider_order(normalized_input)
  let last_errors: Record<string, string> = { result: "読み取りできませんでした。" }

  for (const [index, provider] of providers.entries()) {
    const prefix = index === 0 ? "PRIMARY" : "FALLBACK"
    await send_ocr_server_debug(`OCR_PROVIDER_${prefix}_STARTED`, debug_payload(request, provider))

    try {
      const raw = await call_provider(provider, request)
      const result = normalize_ocr_raw_result(request.document_type, raw)
      await send_ocr_server_debug("OCR_NORMALIZE_COMPLETED", debug_payload(request, provider))
      const validation = validate_ocr_result(request.document_type, result)

      if (should_use_fallback(validation) && index === 0) {
        last_errors = validation.errors
        await send_ocr_server_debug(`OCR_PROVIDER_${prefix}_FAILED`, {
          ...debug_payload(request, provider),
          reason: "unreadable",
        })
        continue
      }

      if (!validation.valid) {
        last_errors = validation.errors
        await send_ocr_server_debug(`OCR_PROVIDER_${prefix}_FAILED`, {
          ...debug_payload(request, provider),
          reason: "validation_failed",
        })
        break
      }

      await send_ocr_server_debug(`OCR_PROVIDER_${prefix}_SUCCESS`, debug_payload(request, provider))
      await send_ocr_server_debug("OCR_ANALYZE_COMPLETED", debug_payload(request, provider))

      return {
        ok: true,
        request_id: request.request_id,
        document_type: request.document_type,
        provider,
        fields: result.fields,
        confidence: result.confidence,
        warnings: result.warnings,
        errors: {},
      }
    } catch (error) {
      last_errors = {
        provider: error instanceof Error ? error.message : "OCR provider failed",
      }
      await send_ocr_server_debug(`OCR_PROVIDER_${prefix}_FAILED`, {
        ...debug_payload(request, provider),
        error: last_errors.provider,
      })
    }
  }

  return {
    ok: false,
    request_id: request.request_id,
    document_type: request.document_type,
    provider: null,
    fields: {},
    confidence: 0,
    warnings: [],
    errors: last_errors,
  }
}
