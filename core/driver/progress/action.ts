import { getRestConfig, readRestError, restHeaders, restUrl } from "@/core/db/rest"
import type { EntryQuestionnaireInput } from "@/core/entry/context"
import type { DriverStatus } from "@/core/driver/context"
import type {
  DriverLicenseRequestContext,
  DriverProgressRequestContext,
} from "@/core/driver/progress/context"
import { parse_driver_license_image } from "@/core/driver/progress/ocr"
import {
  append_progress_entry,
  build_driver_progress_state,
  empty_driver_progress,
  normalize_driver_progress,
  seed_driver_progress_from_entry,
  type DriverProgress,
  type DriverProgressRow,
  type DriverProgressState,
} from "@/core/driver/progress/rules"

const DRIVER_SELECT_FIELDS = [
  "driver_uuid",
  "user_uuid",
  "status",
  "driver_progress",
  "pet_experience",
  "transport_experience",
  "application_reason",
].join(",")

async function fetch_driver_row(user_uuid: string): Promise<DriverProgressRow | null> {
  const config = getRestConfig()

  if (!config) {
    return null
  }

  const response = await fetch(
    restUrl(
      config,
      "drivers",
      [
        `user_uuid=eq.${encodeURIComponent(user_uuid)}`,
        `select=${DRIVER_SELECT_FIELDS}`,
        "limit=1",
      ].join("&"),
    ),
    {
      headers: restHeaders(config),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    return null
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
}) {
  const config = getRestConfig()

  if (!config) {
    throw new Error("Database configuration is missing")
  }

  const response = await fetch(
    restUrl(config, "drivers", `select=${DRIVER_SELECT_FIELDS}`),
    {
      method: "POST",
      headers: {
        ...restHeaders(config),
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        user_uuid: input.user_uuid,
        status: input.status ?? "provisional",
        driver_progress: input.driver_progress ?? empty_driver_progress(),
        pet_experience: input.pet_experience ?? [],
        transport_experience: input.transport_experience ?? null,
        application_reason: input.application_reason ?? null,
      }),
      cache: "no-store",
    },
  )

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

export async function ensure_driver_record(user_uuid: string) {
  const existing = await fetch_driver_row(user_uuid)

  if (existing?.driver_uuid) {
    return existing
  }

  return insert_driver_row({ user_uuid })
}

export async function load_driver_progress_state(
  user_uuid: string | null,
): Promise<DriverProgressState> {
  if (!user_uuid) {
    return build_driver_progress_state(null)
  }

  const row = await ensure_driver_record(user_uuid)

  return build_driver_progress_state(row)
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

  const current = normalize_driver_progress(row.driver_progress)
  const next = append_progress_entry(current, context.input.item, {
    status: context.input.status,
    image_url: context.input.image_url ?? null,
  })

  return save_driver_progress(row.driver_uuid, next, user_uuid)
}

export async function save_driver_license_progress(
  context: DriverLicenseRequestContext,
): Promise<{ state: DriverProgressState; parsed: Record<string, string> }> {
  const user_uuid = context.session.user_uuid

  if (!user_uuid) {
    throw new Error("Driver license upload requires user_uuid")
  }

  const parsed_result = await parse_driver_license_image(context.input.image_url)
  const parsed = {
    last_name: context.input.parsed?.last_name ?? parsed_result.last_name,
    first_name: context.input.parsed?.first_name ?? parsed_result.first_name,
    license_number:
      context.input.parsed?.license_number ?? parsed_result.license_number,
    expiry_date: context.input.parsed?.expiry_date ?? parsed_result.expiry_date,
  }

  const row = await ensure_driver_record(user_uuid)

  if (!row?.driver_uuid) {
    throw new Error("Failed to resolve driver record")
  }

  const current = normalize_driver_progress(row.driver_progress)
  const next = append_progress_entry(current, "driver_license", {
    status: "uploaded",
    image_url: context.input.image_url,
  })

  const state = await save_driver_progress(row.driver_uuid, next, user_uuid)

  return { state, parsed }
}

export async function create_driver_from_entry(input: {
  user_uuid: string
  questionnaire: EntryQuestionnaireInput
  pet_experience: string[]
}) {
  const driver_progress = seed_driver_progress_from_entry(input.questionnaire)
  const existing = await fetch_driver_row(input.user_uuid)

  if (existing?.driver_uuid) {
    await patch_driver_row(existing.driver_uuid, {
      status: "provisional",
      driver_progress,
      pet_experience: input.pet_experience,
      transport_experience: input.questionnaire.transport_experience,
      application_reason: input.questionnaire.application_reason,
    })

    return existing.driver_uuid
  }

  const row = await insert_driver_row({
    user_uuid: input.user_uuid,
    status: "provisional",
    driver_progress,
    pet_experience: input.pet_experience,
    transport_experience: input.questionnaire.transport_experience,
    application_reason: input.questionnaire.application_reason,
  })

  return row?.driver_uuid ?? null
}

export { fetch_driver_row }
