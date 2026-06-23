import type { DriverPreparationState } from "@/core/driver/context"
import type { DriverPreparationValidationResult } from "@/core/driver/rules"

export type DriverPreparationOutput = {
  ok: boolean
  message: string
  state?: DriverPreparationState
  tier_promoted?: boolean
  errors?: Record<string, string>
}

export function build_driver_preparation_validation_output(
  validation: DriverPreparationValidationResult,
): DriverPreparationOutput {
  return {
    ok: false,
    message: "入力内容を確認してください。",
    errors: validation.errors,
  }
}

export function build_driver_preparation_access_denied_output(
  reason: string,
): DriverPreparationOutput {
  return {
    ok: false,
    message:
      reason === "login_required"
        ? "ログインが必要です。"
        : "ドライバー権限が必要です。",
  }
}

export function build_driver_preparation_success_output(input: {
  state: DriverPreparationState
  previous_tier: string
  current_tier: string
}): DriverPreparationOutput {
  const tier_promoted =
    input.previous_tier === "trainee" && input.current_tier === "standard"

  return {
    ok: true,
    message: tier_promoted
      ? "稼働準備が完了しました。稼働可能です。"
      : "準備状況を更新しました。",
    state: input.state,
    tier_promoted,
  }
}
