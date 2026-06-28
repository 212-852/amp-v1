import type { DriverOnboardingTaskKey } from "@/core/driver/context"

export type DriverTaskOpenSource = {
  source_file: string
  source_function: string
  handler_name: string
}

let active_driver_task: DriverOnboardingTaskKey | null = null
let opening_driver_task: DriverOnboardingTaskKey | null = null
let pending_unmount_reason = "unknown"
let last_modal_open_log: {
  task_key: DriverOnboardingTaskKey
  source_hash: string
  logged_at: number
} | null = null
const recent_license_mounts = new Map<
  "license_task",
  Array<{
    component_instance_id: string
    logged_at: number
  }>
>()

function hash_open_source(source: DriverTaskOpenSource) {
  return `${source.source_file}:${source.source_function}:${source.handler_name}`
}

export function try_begin_driver_task_open(task_key: DriverOnboardingTaskKey):
  | { ok: true }
  | { ok: false; reason: string } {
  if (active_driver_task === task_key) {
    return { ok: false, reason: "already_open" }
  }

  if (opening_driver_task === task_key) {
    return { ok: false, reason: "already_opening" }
  }

  if (active_driver_task !== null) {
    return { ok: false, reason: "another_task_open" }
  }

  if (opening_driver_task !== null) {
    return { ok: false, reason: "already_opening" }
  }

  opening_driver_task = task_key
  return { ok: true }
}

export function confirm_driver_task_modal_open(task_key: DriverOnboardingTaskKey) {
  active_driver_task = task_key
  opening_driver_task = null
}

export function mark_driver_task_modal_open(task_key: DriverOnboardingTaskKey) {
  active_driver_task = task_key
  opening_driver_task = null
}

export function mark_driver_task_modal_closed() {
  active_driver_task = null
  opening_driver_task = null
}

export function get_active_driver_task_modal() {
  return active_driver_task
}

export function should_emit_driver_task_modal_open(
  task_key: DriverOnboardingTaskKey,
  source: DriverTaskOpenSource,
) {
  const now = Date.now()
  const source_hash = hash_open_source(source)

  if (
    last_modal_open_log &&
    last_modal_open_log.task_key === task_key &&
    last_modal_open_log.source_hash === source_hash &&
    now - last_modal_open_log.logged_at < 2_000
  ) {
    return false
  }

  last_modal_open_log = {
    task_key,
    source_hash,
    logged_at: now,
  }
  return true
}

export function set_driver_task_unmount_reason(reason: string) {
  pending_unmount_reason = reason
}

export function get_driver_task_unmount_reason() {
  return pending_unmount_reason
}

export function consume_driver_task_unmount_reason() {
  const reason = pending_unmount_reason
  pending_unmount_reason = "unknown"
  return reason
}

export function resolve_driver_task_unmount_reason(
  close_reason: string | null | undefined,
) {
  if (close_reason === "save_completed") {
    return "modal_closed"
  }

  if (close_reason === "user_close" || close_reason === "user_cancel") {
    return "modal_closed"
  }

  if (close_reason === "active_task_changed") {
    return "active_task_changed"
  }

  if (close_reason === "parent_unmounted") {
    return "parent_unmounted"
  }

  if (close_reason === "route_changed") {
    return "route_changed"
  }

  return "unknown"
}

export function record_driver_license_mount(
  component_instance_id: string,
  mount_surface: "license_task",
) {
  const now = Date.now()
  const recent = (recent_license_mounts.get(mount_surface) ?? []).filter(
    (entry) => now - entry.logged_at < 750,
  )

  if (recent.length > 0) {
    return {
      duplicate_detected: true,
      mount_surface,
      previous_component_instance_id:
        recent[recent.length - 1]?.component_instance_id ?? null,
      component_instance_id,
    }
  }

  recent_license_mounts.set(mount_surface, [
    ...recent,
    {
      component_instance_id,
      logged_at: now,
    },
  ])
  return {
    duplicate_detected: false,
    mount_surface,
    component_instance_id,
  }
}

export function clear_driver_license_mount_history() {
  recent_license_mounts.clear()
}
