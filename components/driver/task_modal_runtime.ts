import type { DriverOnboardingTaskKey } from "@/core/driver/context"

let active_driver_task: DriverOnboardingTaskKey | null = null

export function mark_driver_task_modal_open(task: DriverOnboardingTaskKey) {
  active_driver_task = task
}

export function mark_driver_task_modal_closed() {
  active_driver_task = null
}

export function get_active_driver_task_modal() {
  return active_driver_task
}
