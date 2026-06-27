import { empty_driver_license_fields } from "@/core/ocr/context"
import type { DriverLicenseParsedFields, OcrDocumentType } from "@/core/ocr/rules"
import { is_ocr_parse_readable } from "@/core/ocr/rules"
import {
  apply_ocr_to_license_form,
  map_ocr_to_license_form,
} from "@/form/fill"
import {
  create_ocr_pipeline_tracker,
  OcrPipelineStopError,
  type OcrPipelineStep,
  type OcrPipelineTrackerState,
} from "@/core/ocr/pipeline"
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
  pipeline?: OcrPipelineTrackerState
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
  pipeline_steps?: OcrPipelineStep[]
  pipeline_stopped_at?: string | null
  pipeline_stop_reason?: string | null
}

export function has_ocr_license_result(input: {
  parsed: Partial<DriverLicenseParsedFields>
  confidence: number
  document_type?: OcrDocumentType
}) {
  return is_ocr_parse_readable({
    document_type: input.document_type ?? "driver_license_front",
    parsed: input.parsed,
    confidence: input.confidence,
  })
}

async function emit_pipeline_step(
  step: OcrPipelineStep,
  payload: Record<string, unknown>,
) {
  await send_ocr_debug(step, payload)
}

function form_is_complete(form: DriverLicenseParsedFields) {
  return (
    Boolean(form.license_name.trim()) &&
    Boolean(form.license_address.trim()) &&
    Boolean(form.license_birth_date.trim()) &&
    Boolean(form.license_number.trim()) &&
    Boolean(form.license_expiration_date.trim())
  )
}

export async function run_driver_license_ocr_pipeline(input: {
  document_type: OcrDocumentType
  image_url: string
  source: OcrImageSource
  current_form: DriverLicenseParsedFields
}): Promise<ClientOcrReadResult> {
  const empty_parsed = empty_driver_license_fields()
  const pipeline = create_ocr_pipeline_tracker()

  try {
    await emit_pipeline_step("OCR_CAPTURE_STARTED", {
      document_type: input.document_type,
      source: input.source,
    })
    pipeline.complete_step("OCR_CAPTURE_STARTED")
    await emit_pipeline_step("OCR_CAPTURE_COMPLETED", {
      document_type: input.document_type,
      source: input.source,
    })
    pipeline.complete_step("OCR_CAPTURE_COMPLETED")
    await emit_pipeline_step("OCR_ANALYZE_STARTED", {
      document_type: input.document_type,
      source: input.source,
    })

    pipeline.complete_step("OCR_ANALYZE_STARTED")

    const response = await fetch("/api/ocr", {
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
      if (result?.pipeline_steps?.length) {
        pipeline.merge_completed_steps(result.pipeline_steps)
      }

      const pipeline_state: OcrPipelineTrackerState = {
        ...pipeline.snapshot(),
        stopped_at:
          (result?.pipeline_stopped_at as OcrPipelineStep | null) ??
          pipeline.next_expected_step(),
        stop_reason:
          result?.pipeline_stop_reason ??
          result?.message ??
          "ocr_analyze_failed",
      }

      await send_ocr_debug("OCR_PIPELINE_STOPPED", {
        document_type: input.document_type,
        source: input.source,
        ...pipeline_state,
      })

      return {
        ok: false,
        message:
          pipeline_state.stop_reason ??
          result?.message ??
          "OCR読み込みに失敗しました。",
        parsed: empty_parsed,
        confidence: 0,
        warnings: result?.warnings ?? [],
        pipeline: pipeline_state,
      }
    }

    if (result.pipeline_steps?.length) {
      pipeline.merge_completed_steps(result.pipeline_steps)
    }

    const parsed = map_ocr_to_license_form(result.parsed ?? {})
    const confidence = result.confidence ?? 0
    const warnings = result.warnings ?? []

    if (
      !has_ocr_license_result({
        parsed,
        confidence,
      })
    ) {
      const pipeline_state: OcrPipelineTrackerState = {
        ...pipeline.snapshot(),
        stopped_at: pipeline.next_expected_step(),
        stop_reason: "ocr_result_empty",
      }

      await send_ocr_debug("OCR_PIPELINE_STOPPED", {
        document_type: input.document_type,
        source: input.source,
        ...pipeline_state,
      })

      return {
        ok: false,
        message: "免許証を読み取れませんでした。もう一度お試しください。",
        parsed: empty_parsed,
        confidence,
        warnings,
        pipeline: pipeline_state,
      }
    }

    pipeline.complete_step("OCR_FORM_MAP_COMPLETED")
    await emit_pipeline_step("OCR_FORM_MAP_COMPLETED", {
      document_type: input.document_type,
      mapped_fields: parsed,
    })

    pipeline.complete_step("OCR_FORM_FILL_STARTED")
    await emit_pipeline_step("OCR_FORM_FILL_STARTED", {
      document_type: input.document_type,
    })

    const next_form = apply_ocr_to_license_form({
      current: input.current_form,
      mapped: parsed,
    })

    pipeline.complete_step("OCR_FORM_FILL_COMPLETED")
    await emit_pipeline_step("OCR_FORM_FILL_COMPLETED", {
      document_type: input.document_type,
      target_fields: Object.keys(next_form),
    })

    if (!form_is_complete(next_form)) {
      const pipeline_state: OcrPipelineTrackerState = {
        ...pipeline.snapshot(),
        stopped_at: pipeline.next_expected_step(),
        stop_reason: "required_fields_missing",
      }

      await send_ocr_debug("OCR_PIPELINE_STOPPED", {
        document_type: input.document_type,
        source: input.source,
        ...pipeline_state,
      })

      return {
        ok: false,
        message: "必須項目を読み取れませんでした。もう一度お試しください。",
        parsed: next_form,
        confidence,
        warnings,
        pipeline: pipeline_state,
      }
    }

    pipeline.complete_step("OCR_SAVE_STARTED")
    await emit_pipeline_step("OCR_SAVE_STARTED", {
      document_type: input.document_type,
      has_image: Boolean(input.image_url),
      target_fields: Object.keys(next_form),
    })

    const save_response = await fetch("/api/driver/license", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        image_url: input.image_url,
        ...next_form,
      }),
    })
    const save_result = (await save_response.json().catch(() => null)) as
      | OcrApiResponse
      | null

    if (!save_response.ok || save_result?.ok !== true) {
      const pipeline_state: OcrPipelineTrackerState = {
        ...pipeline.snapshot(),
        stopped_at: "OCR_SAVE_STARTED",
        stop_reason: save_result?.message ?? "ocr_save_failed",
      }

      await send_ocr_debug("OCR_PIPELINE_STOPPED", {
        document_type: input.document_type,
        source: input.source,
        ...pipeline_state,
      })

      return {
        ok: false,
        message: save_result?.message ?? "保存できませんでした。",
        parsed: next_form,
        confidence,
        warnings,
        pipeline: pipeline_state,
      }
    }

    pipeline.complete_step("OCR_SAVE_COMPLETED")
    await emit_pipeline_step("OCR_SAVE_COMPLETED", {
      document_type: input.document_type,
      target_fields: Object.keys(next_form),
    })

    return {
      ok: true,
      message: save_result.message ?? "運転免許証を登録しました。",
      parsed: next_form,
      confidence,
      warnings,
      saved: true,
      state: save_result.state,
      pipeline: pipeline.snapshot(),
    }
  } catch (error) {
    const pipeline_state: OcrPipelineTrackerState =
      error instanceof OcrPipelineStopError
        ? pipeline.build_stop_state(error)
        : {
            ...pipeline.snapshot(),
            stopped_at: pipeline.next_expected_step(),
            stop_reason:
              error instanceof Error ? error.message : "ocr_pipeline_failed",
          }

    await send_ocr_debug("OCR_PIPELINE_STOPPED", {
      document_type: input.document_type,
      source: input.source,
      ...pipeline_state,
    })

    return {
      ok: false,
      message:
        pipeline_state.stop_reason ??
        (error instanceof Error ? error.message : "OCR処理に失敗しました。"),
      parsed: empty_parsed,
      confidence: 0,
      warnings: [],
      pipeline: pipeline_state,
    }
  }
}

export async function analyze_ocr_image(input: ClientOcrReadInput) {
  return run_driver_license_ocr_pipeline({
    ...input,
    current_form: empty_driver_license_fields(),
  })
}

export async function read_document_image(input: ClientOcrReadInput) {
  return analyze_ocr_image(input)
}

export function normalize_driver_license_result(
  parsed: Partial<DriverLicenseParsedFields>,
) {
  return map_ocr_to_license_form(parsed)
}

export function apply_ocr_result_to_form(input: {
  current: DriverLicenseParsedFields
  normalized: ReturnType<typeof map_ocr_to_license_form>
}) {
  return apply_ocr_to_license_form({
    current: input.current,
    mapped: input.normalized,
  })
}

export async function read_driver_license_image(input: ClientOcrReadInput) {
  return run_driver_license_ocr_pipeline({
    ...input,
    current_form: empty_driver_license_fields(),
  })
}

export function apply_ocr_to_license_form_legacy(input: {
  current: DriverLicenseParsedFields
  parsed: Partial<DriverLicenseParsedFields>
}) {
  const mapped = map_ocr_to_license_form(input.parsed)
  return apply_ocr_to_license_form({
    current: input.current,
    mapped,
  })
}
