import { getRestConfig, readRestError, restHeaders, restUrl } from "@/core/db/rest"
import type { DriverState, DriverStatus } from "@/core/driver/context"
import type { DriverRequestContext } from "@/core/driver/context"
import {
  build_preparation_items,
  build_preparation_patch,
  is_all_preparation_ready,
  type DriverRow,
} from "@/core/driver/rules"

const DRIVER_SELECT_FIELDS = [
  "driver_uuid",
  "status",
  "has_driver_license",
  "freight_operator",
  "vehicle",
  "black_plate",
  "safety_manager",
].join(",")

async function fetch_driver_row(user_uuid: string): Promise<DriverRow | null> {
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

  const rows = (await response.json()) as DriverRow[]

  return rows[0] ?? null
}

function build_driver_state(row: DriverRow | null): DriverState {
  const items = build_preparation_items(row)
  const status = row?.status ?? "preparing"

  return {
    driver_uuid: row?.driver_uuid ?? null,
    status,
    items,
    all_ready: is_all_preparation_ready(items),
  }
}

export async function load_driver_state(
  user_uuid: string | null,
): Promise<DriverState> {
  if (!user_uuid) {
    return build_driver_state(null)
  }

  const row = await fetch_driver_row(user_uuid)

  return build_driver_state(row)
}

async function patch_driver_record(
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

async function activate_driver_if_ready(driver_uuid: string, user_uuid: string) {
  const state = await load_driver_state(user_uuid)

  if (!state.all_ready || state.status !== "preparing") {
    return state
  }

  await patch_driver_record(driver_uuid, {
    status: "active",
  })

  return load_driver_state(user_uuid)
}

export async function update_driver_preparation(
  context: DriverRequestContext,
): Promise<DriverState> {
  const user_uuid = context.session.user_uuid

  if (!user_uuid) {
    throw new Error("Driver preparation update requires user_uuid")
  }

  const row = await fetch_driver_row(user_uuid)

  if (!row?.driver_uuid) {
    throw new Error("Driver record not found")
  }

  if (row.status !== "preparing") {
    return build_driver_state(row)
  }

  await patch_driver_record(
    row.driver_uuid,
    build_preparation_patch(context.input.item, context.input.ready),
  )

  return activate_driver_if_ready(row.driver_uuid, user_uuid)
}

export async function activate_driver_status(driver_uuid: string) {
  await patch_driver_record(driver_uuid, {
    status: "active" satisfies DriverStatus,
  })
}
