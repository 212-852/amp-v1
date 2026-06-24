import type {
  DriverProgressState,
  DriverProgressValidationResult,
} from "@/core/driver/progress/rules"
import {
  load_driver_page_state,
  log_driver_page_render_failed,
  type DriverPageLoadResult,
} from "@/core/driver/progress/action"

export type DriverProgressOutput = {
  ok: boolean
  message: string
  state?: DriverProgressState
  status_activated?: boolean
  errors?: Record<string, string>
}

export function build_driver_progress_validation_output(
  validation: DriverProgressValidationResult,
): DriverProgressOutput {
  return {
    ok: false,
    message: "入力内容を確認してください。",
    errors: validation.errors,
  }
}

export function build_driver_progress_access_denied_output(
  reason: string,
): DriverProgressOutput {
  return {
    ok: false,
    message:
      reason === "login_required"
        ? "ログインが必要です。"
        : "ドライバー権限が必要です。",
  }
}

export function build_driver_progress_success_output(input: {
  state: DriverProgressState
  previous_status: string
}): DriverProgressOutput {
  const status_activated =
    input.previous_status === "provisional" && input.state.status === "active"

  return {
    ok: true,
    message: status_activated
      ? "稼働準備が完了しました。稼働可能です。"
      : "準備状況を更新しました。",
    state: input.state,
    status_activated,
  }
}

export function build_driver_license_success_output(input: {
  state: DriverProgressState
}): DriverProgressOutput {
  return {
    ok: true,
    message: "運転免許証を登録しました。",
    state: input.state,
    errors: undefined,
  }
}

export type DriverPageOutput = DriverPageLoadResult

export async function resolve_driver_page_state(
  user_uuid: string | null,
): Promise<DriverPageOutput> {
  return load_driver_page_state(user_uuid)
}

export function log_driver_license_step_opened(input: {
  user_uuid: string | null
  driver_uuid: string | null
  has_driver: boolean
  has_driver_progress: boolean
  latest_license_status: string | null
  legacy_has_driver_license: boolean
  current_answer_label: string
  camera_start_requested: boolean
  camera_started: boolean
  camera_error: string | null
}) {
  console.info("DRIVER_LICENSE_STEP_OPENED", input)
}

export function build_driver_page_error_output(input: {
  error_message: string
  user_uuid?: string | null
  driver_uuid?: string | null
  has_driver?: boolean
  has_driver_progress?: boolean
}): DriverPageOutput {
  log_driver_page_render_failed({
    user_uuid: input.user_uuid ?? null,
    driver_uuid: input.driver_uuid ?? null,
    has_driver: input.has_driver ?? false,
    has_driver_progress: input.has_driver_progress ?? false,
    error_message: input.error_message,
  })

  return {
    ok: false,
    error_message: input.error_message,
    has_driver: input.has_driver ?? false,
    has_driver_progress: input.has_driver_progress ?? false,
    driver_uuid: input.driver_uuid ?? null,
  }
}

export type { DriverPageLoadResult }
