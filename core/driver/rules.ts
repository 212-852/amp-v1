import type { SessionRole } from "@/core/auth/types"
import type {
  DriverPreparationItem,
  DriverPreparationKey,
  DriverPreparationUpdateInput,
  DriverRequestContext,
  DriverStatus,
} from "@/core/driver/context"

export const DRIVER_PREP_READY = "ready"

export const DRIVER_PREPARATION_LABELS: Record<DriverPreparationKey, string> = {
  has_driver_license: "普通自動車運転免許",
  freight_operator: "貨物軽自動車運送事業者",
  vehicle: "ペット輸送用車両",
  black_plate: "黒ナンバー",
  safety_manager: "貨物軽自動車安全管理者",
}

export const DRIVER_PREPARATION_KEYS = Object.keys(
  DRIVER_PREPARATION_LABELS,
) as DriverPreparationKey[]

export type DriverRow = {
  driver_uuid?: string | null
  status?: DriverStatus | null
  has_driver_license?: boolean | null
  freight_operator?: string | null
  vehicle?: string | null
  black_plate?: string | null
  safety_manager?: string | null
}

export type DriverPreparationValidationResult = {
  ok: boolean
  errors: Record<string, string>
}

export function is_driver_preparing(status: DriverStatus | null | undefined) {
  return status === "preparing"
}

export function can_driver_operate(status: DriverStatus | null | undefined) {
  return status === "active"
}

export function can_update_driver_preparation(context: DriverRequestContext) {
  if (!context.session.user_uuid) {
    return {
      allowed: false,
      reason: "login_required",
    } as const
  }

  if (context.session.role !== "driver") {
    return {
      allowed: false,
      reason: "driver_role_required",
    } as const
  }

  return {
    allowed: true,
    reason: null,
  } as const
}

export function validate_driver_preparation_update(
  input: DriverPreparationUpdateInput,
): DriverPreparationValidationResult {
  if (!DRIVER_PREPARATION_KEYS.includes(input.item)) {
    return {
      ok: false,
      errors: {
        item: "準備項目が不正です。",
      },
    }
  }

  return {
    ok: true,
    errors: {},
  }
}

export function is_preparation_item_ready(
  key: DriverPreparationKey,
  row: DriverRow | null,
) {
  if (!row) {
    return false
  }

  if (key === "has_driver_license") {
    return Boolean(row.has_driver_license)
  }

  return row[key] === DRIVER_PREP_READY
}

export function build_preparation_items(row: DriverRow | null): DriverPreparationItem[] {
  return DRIVER_PREPARATION_KEYS.map((key) => ({
    key,
    label: DRIVER_PREPARATION_LABELS[key],
    ready: is_preparation_item_ready(key, row),
  }))
}

export function is_all_preparation_ready(items: DriverPreparationItem[]) {
  return items.length > 0 && items.every((item) => item.ready)
}

export function build_preparation_patch(
  item: DriverPreparationKey,
  ready: boolean,
) {
  if (item === "has_driver_license") {
    return {
      has_driver_license: ready,
    }
  }

  return {
    [item]: ready ? DRIVER_PREP_READY : null,
  }
}

export function can_show_driver_preparation(input: {
  role: SessionRole
  status: DriverStatus | null | undefined
}) {
  return input.role === "driver" && (input.status === "preparing" || input.status === "active")
}
