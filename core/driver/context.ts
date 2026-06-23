import type { AuthContext, Session } from "@/core/auth/types"

export type DriverPreparationKey =
  | "business_notification_ready"
  | "vehicle_ready"
  | "black_plate_ready"
  | "safety_manager_ready"

export type DriverPreparationItem = {
  key: DriverPreparationKey
  label: string
  ready: boolean
}

export type DriverPreparationState = {
  driver_uuid: string | null
  items: DriverPreparationItem[]
  all_ready: boolean
}

export type DriverPreparationUpdateInput = {
  item: DriverPreparationKey
  ready: boolean
}

export type DriverRequestContext = {
  auth: AuthContext
  session: Session
  input: DriverPreparationUpdateInput
}

export function build_driver_preparation_context(input: {
  auth: AuthContext
  session: Session
  body: Record<string, unknown>
}): DriverRequestContext {
  const item = readPreparationKey(input.body.item)
  const ready = readBoolean(input.body.ready)

  return {
    auth: input.auth,
    session: input.session,
    input: {
      item,
      ready,
    },
  }
}

function readPreparationKey(value: unknown): DriverPreparationKey {
  if (
    value === "business_notification_ready" ||
    value === "vehicle_ready" ||
    value === "black_plate_ready" ||
    value === "safety_manager_ready"
  ) {
    return value
  }

  return "business_notification_ready"
}

function readBoolean(value: unknown) {
  return value === true || value === "true" || value === "1" || value === "on"
}
