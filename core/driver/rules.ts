import type { SessionRole, SessionTier } from "@/core/auth/types"
import type {
  DriverPreparationItem,
  DriverPreparationKey,
  DriverPreparationUpdateInput,
  DriverRequestContext,
} from "@/core/driver/context"

export const DRIVER_PREPARATION_LABELS: Record<DriverPreparationKey, string> = {
  business_notification_ready: "事業の届出",
  vehicle_ready: "車両",
  black_plate_ready: "黒ナンバー",
  safety_manager_ready: "安全管理者",
}

export const DRIVER_PREPARATION_KEYS = Object.keys(
  DRIVER_PREPARATION_LABELS,
) as DriverPreparationKey[]

export type DriverPreparationRow = {
  driver_uuid?: string | null
  business_notification_ready?: boolean | null
  vehicle_ready?: boolean | null
  black_plate_ready?: boolean | null
  safety_manager_ready?: boolean | null
}

export type DriverPreparationValidationResult = {
  ok: boolean
  errors: Record<string, string>
}

export function is_trainee_driver(input: {
  role: SessionRole
  tier: SessionTier
}) {
  return input.role === "driver" && input.tier === "trainee"
}

export function can_driver_operate(input: {
  role: SessionRole
  tier: SessionTier
}) {
  return input.role === "driver" && input.tier === "standard"
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

export function build_preparation_items(
  row: DriverPreparationRow | null,
): DriverPreparationItem[] {
  return DRIVER_PREPARATION_KEYS.map((key) => ({
    key,
    label: DRIVER_PREPARATION_LABELS[key],
    ready: Boolean(row?.[key]),
  }))
}

export function is_all_preparation_ready(items: DriverPreparationItem[]) {
  return items.length > 0 && items.every((item) => item.ready)
}
