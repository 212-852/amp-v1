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
  entry_uuid: string | null
  driver_uuid: string | null
}): EntrySubmitOutput {
  return {
    ok: true,
    message: "応募ありがとうございます。",
    redirect_path: null,
    show_success: true,
    entry_uuid: input.entry_uuid,
    driver_uuid: input.driver_uuid,
  }
}
