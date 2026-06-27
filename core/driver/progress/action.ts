import { getRestConfig, readRestError, restHeaders, restUrl } from "@/core/db/rest"
import type { EntryQuestionnaireInput } from "@/core/entry/context"
import type { DriverStatus } from "@/core/driver/context"
import type {
  DriverLicenseOcrRequestContext,
  DriverLicenseRequestContext,
  DriverProgressRequestContext,
} from "@/core/driver/progress/context"
import {
  append_progress_entry,
  build_driver_progress_state,
  empty_driver_progress,
  normalize_driver_progress,
  normalize_driver_progress_value,
  seed_driver_progress_from_entry,
  type DriverProgress,
  type DriverProgressRow,
  type DriverProgressState,
} from "@/core/driver/progress/rules"
import { run_ocr } from "@/core/ocr/action"
import {
  empty_driver_license_fields,
  merge_driver_license_fields,
} from "@/core/ocr/context"
import { validate_license_save } from "@/core/ocr/rules"

const DRIVER_CORE_FIELDS = ["driver_uuid", "user_uuid", "status"].join(",")

const DRIVER_PROGRESS_FIELDS = [
  "driver_uuid",
  "user_uuid",
  "status",
  "driver_progress",
  "has_driver_license",
].join(",")

const DRIVER_ENTRY_FIELDS = [
  "driver_uuid",
  "user_uuid",
  "status",
  "driver_progress",
  "pet_experience",
  "transport_experience",
  "application_reason",
].join(",")

type FetchDriverRowResult = {
  row: DriverProgressRow | null
  has_driver_progress_column: boolean
  error_message: string | null
}

function is_missing_column_error(
  error: {
    code?: string
    message?: string
    details?: string
  },
  column: string,
) {
  const haystack = [error.code, error.message, error.details]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()

  return (
    haystack.includes(column.toLowerCase()) ||
    error.code === "42703" ||
    error.code === "PGRST204"
  )
}

async function query_driver_row(
  user_uuid: string,
  select: string,
): Promise<{ ok: true; row: DriverProgressRow | null } | { ok: false; error: string }> {
  const config = getRestConfig()

  if (!config) {
    return { ok: false, error: "Database configuration is missing" }
  }

  try {
    const response = await fetch(
      restUrl(
        config,
        "drivers",
        [
          `user_uuid=eq.${encodeURIComponent(user_uuid)}`,
          `select=${select}`,
          "limit=1",
        ].join("&"),
      ),
      {
        headers: restHeaders(config),
        cache: "no-store",
      },
    )

    if (!response.ok) {
      const error = await readRestError(response)

      return {
        ok: false,
        error: error.message ?? `drivers fetch failed (${response.status})`,
      }
    }

    const rows = (await response.json()) as DriverProgressRow[]

    return { ok: true, row: rows[0] ?? null }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "drivers fetch failed",
    }
  }
}

async function fetch_driver_row(user_uuid: string): Promise<FetchDriverRowResult> {
  const with_progress = await query_driver_row(user_uuid, DRIVER_PROGRESS_FIELDS)

  if (with_progress.ok) {
    return {
      row: with_progress.row,
      has_driver_progress_column: true,
      error_message: null,
    }
  }

  const progress_error = with_progress.error
  const config = getRestConfig()

  if (config) {
    try {
      const probe = await fetch(
        restUrl(
          config,
          "drivers",
          [
            `user_uuid=eq.${encodeURIComponent(user_uuid)}`,
            "select=driver_progress,has_driver_license",
            "limit=0",
          ].join("&"),
        ),
        {
          headers: restHeaders(config),
          cache: "no-store",
        },
      )

      if (!probe.ok) {
        const probe_error = await readRestError(probe)

        if (is_missing_column_error(probe_error, "driver_progress")) {
          const core = await query_driver_row(user_uuid, DRIVER_CORE_FIELDS)

          if (core.ok) {
            return {
              row: core.row,
              has_driver_progress_column: false,
              error_message: null,
            }
          }

          return {
            row: null,
            has_driver_progress_column: false,
            error_message: core.error,
          }
        }

        if (is_missing_column_error(probe_error, "has_driver_license")) {
          const without_legacy = await query_driver_row(
            user_uuid,
            DRIVER_PROGRESS_FIELDS.replace(",has_driver_license", ""),
          )

          if (without_legacy.ok) {
            return {
              row: without_legacy.row,
              has_driver_progress_column: true,
              error_message: null,
            }
          }
        }
      }
    } catch {
      // Fall through to core-only fetch.
    }
  }

  const without_legacy = await query_driver_row(
    user_uuid,
    DRIVER_PROGRESS_FIELDS.replace(",has_driver_license", ""),
  )

  if (without_legacy.ok) {
    return {
      row: without_legacy.row,
      has_driver_progress_column: true,
      error_message: null,
    }
  }

  const core = await query_driver_row(user_uuid, DRIVER_CORE_FIELDS)

  if (core.ok) {
    return {
      row: core.row,
      has_driver_progress_column: false,
      error_message: null,
    }
  }

  return {
    row: null,
    has_driver_progress_column: false,
    error_message: core.error ?? progress_error,
  }
}

async function post_driver_row(input: {
  body: Record<string, unknown>
  select: string
}) {
  const config = getRestConfig()

  if (!config) {
    throw new Error("Database configuration is missing")
  }

  const response = await fetch(restUrl(config, "drivers", `select=${input.select}`), {
    method: "POST",
    headers: {
      ...restHeaders(config),
      Prefer: "return=representation",
    },
    body: JSON.stringify(input.body),
    cache: "no-store",
  })

  if (!response.ok) {
    const error = await readRestError(response)

    throw new Error(
      `Failed to create driver record: ${error.code ?? "unknown"} ${
        error.message ?? "No PostgREST error returned"
      }`,
    )
  }

  const rows = (await response.json()) as DriverProgressRow[]

  return rows[0] ?? null
}

async function insert_driver_row(input: {
  user_uuid: string
  status?: DriverStatus
  driver_progress?: DriverProgress
  pet_experience?: string[]
  transport_experience?: string | null
  application_reason?: string | null
  include_driver_progress?: boolean
}) {
  const include_driver_progress = input.include_driver_progress ?? true
  const body: Record<string, unknown> = {
    user_uuid: input.user_uuid,
    status: input.status ?? "provisional",
  }

  if (input.pet_experience !== undefined) {
    body.pet_experience = input.pet_experience
  }

  if (input.transport_experience !== undefined) {
    body.transport_experience = input.transport_experience
  }

  if (input.application_reason !== undefined) {
    body.application_reason = input.application_reason
  }

  if (include_driver_progress) {
    body.driver_progress = input.driver_progress ?? empty_driver_progress()
  }

  return post_driver_row({
    body,
    select: include_driver_progress ? DRIVER_ENTRY_FIELDS : DRIVER_CORE_FIELDS,
  })
}

async function insert_driver_row_for_page(
  user_uuid: string,
  include_driver_progress: boolean,
) {
  const attempts: Array<{
    status: DriverStatus
    include_driver_progress: boolean
    pet_experience?: string[]
    transport_experience?: string | null
    application_reason?: string | null
  }> = [
    { status: "provisional", include_driver_progress },
    { status: "provisional", include_driver_progress: false },
    {
      status: "provisional",
      include_driver_progress: false,
      pet_experience: [],
      transport_experience: "no",
      application_reason: "",
    },
  ]

  for (const attempt of attempts) {
    try {
      const row = await insert_driver_row({
        user_uuid,
        status: attempt.status,
        include_driver_progress: attempt.include_driver_progress,
        pet_experience: attempt.pet_experience,
        transport_experience: attempt.transport_experience,
        application_reason: attempt.application_reason,
      })

      if (row?.driver_uuid) {
        return row
      }
    } catch {
      continue
    }
  }

  return null
}

async function patch_driver_row(
  driver_uuid: string,
  patch: Record<string, unknown>,
) {
  const config = getRestConfig()

  if (!config) {
    throw new Error("Database configuration is missing")
  }

  const response = await fetch(
    restUrl(
      config,
      "drivers",
      `driver_uuid=eq.${encodeURIComponent(driver_uuid)}`,
    ),
    {
      method: "PATCH",
      headers: restHeaders(config),
      body: JSON.stringify(patch),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    const error = await readRestError(response)

    throw new Error(
      `Failed to update driver record: ${error.code ?? "unknown"} ${
        error.message ?? "No PostgREST error returned"
      }`,
    )
  }
}

function is_duplicate_driver_error(error: unknown) {
  const message =
    error instanceof Error
      ? error.message.toLowerCase()
      : String(error).toLowerCase()

  return (
    message.includes("duplicate") ||
    message.includes("unique constraint") ||
    message.includes("23505")
  )
}

export async function ensure_driver_record(user_uuid: string) {
  const fetched = await fetch_driver_row(user_uuid)

  if (fetched.row?.driver_uuid) {
    return fetched.row
  }

  try {
    const created = await insert_driver_row_for_page(
      user_uuid,
      fetched.has_driver_progress_column,
    )

    if (created?.driver_uuid) {
      return created
    }
  } catch (error) {
    if (is_duplicate_driver_error(error)) {
      const retry = await fetch_driver_row(user_uuid)

      if (retry.row?.driver_uuid) {
        return retry.row
      }
    }

    throw error
  }

  const retry = await fetch_driver_row(user_uuid)

  if (retry.row?.driver_uuid) {
    return retry.row
  }

  throw new Error("Failed to resolve driver record")
}

async function ensure_driver_record_safe(user_uuid: string) {
  try {
    return await ensure_driver_record(user_uuid)
  } catch {
    const fetched = await fetch_driver_row(user_uuid)

    return fetched.row
  }
}

export type DriverPageLoadResult =
  | {
      ok: true
      state: DriverProgressState
      has_driver: boolean
      has_driver_progress: boolean
      driver_uuid: string | null
    }
  | {
      ok: false
      error_message: string
      has_driver: boolean
      has_driver_progress: boolean
      driver_uuid: string | null
    }

export function log_driver_page_render_failed(input: {
  user_uuid: string | null
  driver_uuid: string | null
  has_driver: boolean
  has_driver_progress: boolean
  error_message: string
}) {
  console.error("DRIVER_PAGE_RENDER_FAILED", input)
}

export async function load_driver_page_state(
  user_uuid: string | null,
): Promise<DriverPageLoadResult> {
  if (!user_uuid) {
    return {
      ok: true,
      state: build_driver_progress_state(null),
      has_driver: false,
      has_driver_progress: false,
      driver_uuid: null,
    }
  }

  try {
    const fetched = await fetch_driver_row(user_uuid)
    let row = fetched.row

    if (!row?.driver_uuid) {
      row = await ensure_driver_record_safe(user_uuid)
    }

    if (!row?.driver_uuid) {
      return {
        ok: false,
        error_message: fetched.error_message ?? "Failed to resolve driver record",
        has_driver: false,
        has_driver_progress: fetched.has_driver_progress_column,
        driver_uuid: null,
      }
    }

    return {
      ok: true,
      state: build_driver_progress_state(row),
      has_driver: true,
      has_driver_progress:
        fetched.has_driver_progress_column && row.driver_progress != null,
      driver_uuid: row.driver_uuid ?? null,
    }
  } catch (error) {
    const error_message =
      error instanceof Error ? error.message : "Failed to load driver progress"

    return {
      ok: false,
      error_message,
      has_driver: false,
      has_driver_progress: false,
      driver_uuid: null,
    }
  }
}

export async function load_driver_progress_state(
  user_uuid: string | null,
): Promise<DriverProgressState> {
  const result = await load_driver_page_state(user_uuid)

  if (result.ok) {
    return result.state
  }

  return build_driver_progress_state(null)
}

async function save_driver_progress(
  driver_uuid: string,
  progress: DriverProgress,
  user_uuid: string,
) {
  await patch_driver_row(driver_uuid, {
    driver_progress: progress,
  })

  const state = await load_driver_progress_state(user_uuid)

  if (!state.all_complete || state.status !== "provisional") {
    return state
  }

  await patch_driver_row(driver_uuid, {
    status: "active",
  })

  return load_driver_progress_state(user_uuid)
}

export async function append_driver_progress(
  context: DriverProgressRequestContext,
): Promise<DriverProgressState> {
  const user_uuid = context.session.user_uuid

  if (!user_uuid) {
    throw new Error("Driver progress update requires user_uuid")
  }

  const row = await ensure_driver_record(user_uuid)

  if (!row?.driver_uuid) {
    throw new Error("Failed to resolve driver record")
  }

  if (row.status !== "provisional") {
    return build_driver_progress_state(row)
  }

  const current = normalize_driver_progress(row)
  const next = append_progress_entry(current, context.input.item, {
    status: context.input.status,
    image_url: context.input.image_url ?? null,
  })

  return save_driver_progress(row.driver_uuid, next, user_uuid)
}

export async function save_driver_license_progress(
  context: DriverLicenseRequestContext,
): Promise<{
  state: DriverProgressState
  previous_state: DriverProgressState
}> {
  const user_uuid = context.session.user_uuid

  if (!user_uuid) {
    throw new Error("Driver license upload requires user_uuid")
  }

  const row = await ensure_driver_record(user_uuid)

  if (!row?.driver_uuid) {
    throw new Error("Failed to resolve driver record")
  }

  const current = normalize_driver_progress(row)
  const previous_state = build_driver_progress_state(row)
  const next = append_progress_entry(current, "driver_license", {
    status: "uploaded",
    image_url: context.input.image_url,
    license_name: context.input.license_name || null,
    license_address: context.input.license_address || null,
    license_birth_date: context.input.license_birth_date || null,
    license_number: context.input.license_number || null,
    license_expiration_date: context.input.license_expiration_date || null,
  })

  const state = await save_driver_progress(row.driver_uuid, next, user_uuid)

  return { state, previous_state }
}

export async function save_driver_license_progress_from_ocr(
  context: DriverLicenseOcrRequestContext,
): Promise<{
  parsed: ReturnType<typeof empty_driver_license_fields>
  confidence: number
  warnings: string[]
  state: DriverProgressState | null
  saved: boolean
  errors: Record<string, string>
}> {
  const progress_before = await load_driver_progress_state(
    context.session.user_uuid,
  )
  const ocr_result = await run_ocr({
    auth: context.auth,
    session: context.session,
    input: {
      document_type: context.input.document_type,
      image_url: context.input.image_url,
    },
  })
  const parsed = merge_driver_license_fields(
    empty_driver_license_fields(),
    ocr_result.parsed,
  )
  const upload_input = {
    image_url: context.input.image_url,
    ...parsed,
  }
  const validation = validate_license_save(upload_input)

  console.log("[OCR_FLOW] autofill_start", {
    parsed_ocr_result: ocr_result.parsed,
    target_form_field_names: Object.keys(parsed),
  })
  console.log("[OCR_FLOW] autofill_success", {
    normalized_result: parsed,
    target_form_field_names: Object.keys(parsed),
  })

  if (!validation.ok) {
    console.log("[OCR_FLOW] progress_update", {
      phase: "skipped_incomplete_ocr",
      progress_before,
      progress_after: progress_before,
      saved_answer_payload: upload_input,
      errors: validation.errors,
    })

    return {
      parsed,
      confidence: ocr_result.confidence,
      warnings: ocr_result.warnings,
      state: null,
      saved: false,
      errors: validation.errors,
    }
  }

  console.log("[OCR_FLOW] progress_update", {
    phase: "before_save",
    progress_before,
    saved_answer_payload: upload_input,
  })

  const saved = await save_driver_license_progress({
    auth: context.auth,
    session: context.session,
    input: upload_input,
  })

  console.log("[OCR_FLOW] progress_update", {
    phase: "after_save",
    progress_before: saved.previous_state,
    progress_after: saved.state,
    saved_answer_payload: upload_input,
  })
  console.log("[OCR_FLOW] completed", {
    document_type: context.input.document_type,
  })

  return {
    parsed,
    confidence: ocr_result.confidence,
    warnings: ocr_result.warnings,
    state: saved.state,
    saved: true,
    errors: {},
  }
}

export async function create_driver_from_entry(input: {
  user_uuid: string
  questionnaire: EntryQuestionnaireInput
  pet_experience: string[]
}) {
  const driver_progress = seed_driver_progress_from_entry(input.questionnaire)
  const fetched = await fetch_driver_row(input.user_uuid)
  const existing = fetched.row

  if (existing?.driver_uuid) {
    const patch: Record<string, unknown> = {
      status: "provisional",
      pet_experience: input.pet_experience,
      transport_experience: input.questionnaire.transport_experience,
      application_reason: input.questionnaire.application_reason,
    }

    if (fetched.has_driver_progress_column) {
      patch.driver_progress = driver_progress
    }

    await patch_driver_row(existing.driver_uuid, patch)

    return existing.driver_uuid
  }

  const row = await insert_driver_row({
    user_uuid: input.user_uuid,
    status: "provisional",
    driver_progress,
    pet_experience: input.pet_experience,
    transport_experience: input.questionnaire.transport_experience,
    application_reason: input.questionnaire.application_reason,
    include_driver_progress: fetched.has_driver_progress_column,
  })

  return row?.driver_uuid ?? null
}

export { fetch_driver_row, normalize_driver_progress_value }
