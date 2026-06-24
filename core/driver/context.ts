import type { AuthContext, Session } from "@/core/auth/types"

export type DriverStatus = "provisional" | "active" | "suspended" | "retired"

export type DriverPreparationKey =
  | "has_driver_license"
  | "freight_operator"
  | "vehicle"
  | "black_plate"
  | "safety_manager"

export type DriverPreparationItem = {
  key: DriverPreparationKey
  label: string
  ready: boolean
}

export type DriverState = {
  driver_uuid: string | null
  status: DriverStatus
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
    value === "has_driver_license" ||
    value === "freight_operator" ||
    value === "vehicle" ||
    value === "black_plate" ||
    value === "safety_manager"
  ) {
    return value
  }

  return "has_driver_license"
}

function readBoolean(value: unknown) {
  return value === true || value === "true" || value === "1" || value === "on"
}
