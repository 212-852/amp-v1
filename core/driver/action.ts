import { getRestConfig, readRestError, restHeaders, restUrl } from "@/core/db/rest"
import { promote_driver_to_standard } from "@/core/auth/role_tier"
import type { DriverPreparationState } from "@/core/driver/context"
import type { DriverRequestContext } from "@/core/driver/context"
import {
  build_preparation_items,
  is_all_preparation_ready,
  type DriverPreparationRow,
} from "@/core/driver/rules"

async function fetch_driver_preparation_row(
  user_uuid: string,
): Promise<DriverPreparationRow | null> {
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
        "select=driver_uuid,business_notification_ready,vehicle_ready,black_plate_ready,safety_manager_ready",
        "order=created_at.desc",
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

  const rows = (await response.json()) as DriverPreparationRow[]

  return rows[0] ?? null
}

export async function load_driver_preparation_state(
  user_uuid: string | null,
): Promise<DriverPreparationState> {
  if (!user_uuid) {
    return {
      driver_uuid: null,
      items: build_preparation_items(null),
      all_ready: false,
    }
  }

  const row = await fetch_driver_preparation_row(user_uuid)
  const items = build_preparation_items(row)

  return {
    driver_uuid: row?.driver_uuid ?? null,
    items,
    all_ready: is_all_preparation_ready(items),
  }
}

async function patch_driver_preparation_item(
  driver_uuid: string,
  item: keyof DriverPreparationRow,
  ready: boolean,
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
      body: JSON.stringify({
        [item]: ready,
      }),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    const error = await readRestError(response)

    throw new Error(
      `Failed to update driver preparation: ${error.code ?? "unknown"} ${
        error.message ?? "No PostgREST error returned"
      }`,
    )
  }
}

export async function update_driver_preparation(
  context: DriverRequestContext,
): Promise<DriverPreparationState> {
  const user_uuid = context.session.user_uuid

  if (!user_uuid) {
    throw new Error("Driver preparation update requires user_uuid")
  }

  const row = await fetch_driver_preparation_row(user_uuid)

  if (!row?.driver_uuid) {
    throw new Error("Driver record not found")
  }

  await patch_driver_preparation_item(
    row.driver_uuid,
    context.input.item,
    context.input.ready,
  )

  const state = await load_driver_preparation_state(user_uuid)

  if (state.all_ready) {
    await promote_driver_to_standard(user_uuid)
  }

  return state
}
