import type { DriverProgressState, DriverProgressRow } from "@/core/driver/progress/rules"
import type { DriverProgressValidationResult } from "@/core/driver/progress/rules"

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
  parsed: Record<string, string>
}): DriverProgressOutput {
  return {
    ok: true,
    message: "運転免許証を登録しました。",
    state: input.state,
    errors: undefined,
  }
}

export type { DriverProgressRow }
