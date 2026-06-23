import type { EntryValidationResult } from "@/core/entry/rules"

export type EntrySubmitOutput = {
  ok: boolean
  message: string
  redirect_path: string | null
  show_success: boolean
  errors?: Record<string, string>
  entry_uuid?: string | null
  driver_uuid?: string | null
}

export function build_entry_validation_output(
  validation: EntryValidationResult,
): EntrySubmitOutput {
  return {
    ok: false,
    message: "入力内容を確認してください。",
    redirect_path: null,
    show_success: false,
    errors: validation.errors,
  }
}

export function build_entry_success_output(input: {
  driver_uuid: string | null
}): EntrySubmitOutput {
  return {
    ok: true,
    message:
      "仮登録が完了しました。ドライバー画面で稼働に必要な準備を進めてください。",
    redirect_path: "/driver",
    show_success: true,
    entry_uuid: null,
    driver_uuid: input.driver_uuid,
  }
}
