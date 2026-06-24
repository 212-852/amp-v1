import type { EntryQuestionnaireInput } from "@/core/entry/context"
import type { SessionRole } from "@/core/auth/types"
import type { DriverStatus } from "@/core/driver/context"

export type DriverProgressKey =
  | "driver_license"
  | "vehicle"
  | "freight_operator"
  | "black_plate"
  | "safety_manager"

export type DriverProgressEntry = {
  status: string
  created_at: string
  image_url?: string | null
}

export type DriverProgress = Record<DriverProgressKey, DriverProgressEntry[]>

export type DriverProgressRow = {
  driver_uuid?: string | null
  user_uuid?: string | null
  status?: DriverStatus | null
  driver_progress?: DriverProgress | null
  pet_experience?: string[] | null
  transport_experience?: string | null
  application_reason?: string | null
}

export type DriverChecklistItem = {
  key: DriverProgressKey
  label: string
  complete: boolean
  latest_status: string | null
}

export type DriverProgressState = {
  driver_uuid: string | null
  status: DriverStatus
  items: DriverChecklistItem[]
  progress: DriverProgress
  completed_count: number
  total_count: number
  all_complete: boolean
}

export type DriverProgressValidationResult = {
  ok: boolean
  errors: Record<string, string>
}

export const DRIVER_PROGRESS_KEYS: DriverProgressKey[] = [
  "driver_license",
  "vehicle",
  "freight_operator",
  "black_plate",
  "safety_manager",
]

export const DRIVER_PROGRESS_LABELS: Record<DriverProgressKey, string> = {
  driver_license: "普通自動車運転免許証",
  vehicle: "ペット輸送用車両",
  freight_operator: "貨物軽自動車運送事業者",
  black_plate: "黒ナンバー",
  safety_manager: "貨物軽自動車安全管理者",
}

const COMPLETE_STATUSES: Record<DriverProgressKey, Set<string>> = {
  driver_license: new Set(["approved", "verified", "completed", "uploaded"]),
  vehicle: new Set(["owned", "registered", "approved"]),
  freight_operator: new Set(["acquired", "approved"]),
  black_plate: new Set(["issued", "approved"]),
  safety_manager: new Set(["acquired", "approved"]),
}

export function empty_driver_progress(): DriverProgress {
  return {
    driver_license: [],
    vehicle: [],
    freight_operator: [],
    black_plate: [],
    safety_manager: [],
  }
}

export function normalize_driver_progress_value(value: unknown): DriverProgress {
  const empty = empty_driver_progress()

  if (value == null) {
    return empty
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return empty
  }

  const record = value as Record<string, unknown>
  const normalized = empty_driver_progress()

  for (const key of DRIVER_PROGRESS_KEYS) {
    const entries = record[key]

    if (!Array.isArray(entries)) {
      continue
    }

    normalized[key] = entries
      .filter((entry): entry is Record<string, unknown> => {
        return Boolean(entry) && typeof entry === "object" && !Array.isArray(entry)
      })
      .map((entry) => ({
        status: typeof entry.status === "string" ? entry.status.trim() : "",
        created_at:
          typeof entry.created_at === "string"
            ? entry.created_at
            : new Date().toISOString(),
        image_url:
          typeof entry.image_url === "string" ? entry.image_url.trim() : null,
      }))
      .filter((entry) => entry.status.length > 0)
  }

  return normalized
}

export function normalize_driver_progress(
  driver: DriverProgressRow | null | undefined,
): DriverProgress {
  if (!driver) {
    return empty_driver_progress()
  }

  return normalize_driver_progress_value(driver.driver_progress)
}

export function get_latest_progress_entry(
  progress: DriverProgress,
  key: DriverProgressKey,
): DriverProgressEntry | null {
  const entries = progress[key]

  if (!entries.length) {
    return null
  }

  return entries[entries.length - 1] ?? null
}

export function get_latest_progress_status(
  progress: DriverProgress,
  key: DriverProgressKey,
) {
  return get_latest_progress_entry(progress, key)?.status ?? null
}

export function is_progress_item_complete(
  progress: DriverProgress,
  key: DriverProgressKey,
) {
  const latest = get_latest_progress_status(progress, key)

  if (!latest) {
    return false
  }

  return COMPLETE_STATUSES[key].has(latest)
}

export function build_checklist_items(progress: DriverProgress): DriverChecklistItem[] {
  return DRIVER_PROGRESS_KEYS.map((key) => ({
    key,
    label: DRIVER_PROGRESS_LABELS[key],
    complete: is_progress_item_complete(progress, key),
    latest_status: get_latest_progress_status(progress, key),
  }))
}

export function count_completed_items(items: DriverChecklistItem[]) {
  return items.filter((item) => item.complete).length
}

export function is_all_progress_complete(progress: DriverProgress) {
  return DRIVER_PROGRESS_KEYS.every((key) => is_progress_item_complete(progress, key))
}

export function append_progress_entry(
  progress: DriverProgress,
  key: DriverProgressKey,
  entry: Omit<DriverProgressEntry, "created_at"> & { created_at?: string },
): DriverProgress {
  const next = normalize_driver_progress_value(progress)

  next[key] = [
    ...next[key],
    {
      status: entry.status,
      created_at: entry.created_at ?? new Date().toISOString(),
      image_url: entry.image_url ?? null,
    },
  ]

  return next
}

export function build_driver_progress_state(row: DriverProgressRow | null): DriverProgressState {
  const progress = normalize_driver_progress(row)
  const items = build_checklist_items(progress)

  return {
    driver_uuid: row?.driver_uuid ?? null,
    status: row?.status ?? "provisional",
    items,
    progress,
    completed_count: count_completed_items(items),
    total_count: DRIVER_PROGRESS_KEYS.length,
    all_complete: is_all_progress_complete(progress),
  }
}

export function seed_driver_progress_from_entry(
  questionnaire: EntryQuestionnaireInput,
): DriverProgress {
  const progress = empty_driver_progress()
  const created_at = new Date().toISOString()

  if (questionnaire.has_driver_license) {
    progress.driver_license.push({ status: "uploaded", created_at })
  }

  if (questionnaire.vehicle) {
    progress.vehicle.push({ status: questionnaire.vehicle, created_at })
  }

  if (questionnaire.freight_operator) {
    const status =
      questionnaire.freight_operator === "obtained"
        ? "acquired"
        : questionnaire.freight_operator

    progress.freight_operator.push({ status, created_at })
  }

  if (questionnaire.safety_manager) {
    const status =
      questionnaire.safety_manager === "obtained"
        ? "acquired"
        : questionnaire.safety_manager

    progress.safety_manager.push({ status, created_at })
  }

  return progress
}

export function validate_progress_append(input: {
  item: DriverProgressKey
  status: string
}) {
  const errors: Record<string, string> = {}

  if (!DRIVER_PROGRESS_KEYS.includes(input.item)) {
    errors.item = "準備項目が不正です。"
  }

  if (!input.status.trim()) {
    errors.status = "ステータスが必要です。"
  }

  return {
    ok: Object.keys(errors).length === 0,
    errors,
  } satisfies DriverProgressValidationResult
}

export function validate_license_upload(input: {
  image_url: string
}) {
  const errors: Record<string, string> = {}

  if (!input.image_url.trim()) {
    errors.image_url = "画像が必要です。"
  }

  return {
    ok: Object.keys(errors).length === 0,
    errors,
  } satisfies DriverProgressValidationResult
}

export function is_driver_provisional(status: DriverStatus | null | undefined) {
  return status === "provisional"
}

export function can_driver_operate(status: DriverStatus | null | undefined) {
  return status === "active"
}

export function can_update_driver_progress(input: {
  role: SessionRole
  user_uuid: string | null
}) {
  if (!input.user_uuid) {
    return { allowed: false, reason: "login_required" } as const
  }

  if (input.role !== "driver") {
    return { allowed: false, reason: "driver_role_required" } as const
  }

  return { allowed: true, reason: null } as const
}

export function can_show_driver_onboarding(input: {
  role: SessionRole
  status: DriverStatus | null | undefined
}) {
  return input.role === "driver" && is_driver_provisional(input.status)
}
