import type { EntryValidationResult } from "@/core/entry/rules"

export type EntrySubmitOutput = {
  ok: boolean
  message: string
  redirect_path: string | null
  errors?: Record<string, string>
  entry_uuid?: string | null
}

export function build_entry_validation_output(
  validation: EntryValidationResult,
): EntrySubmitOutput {
  return {
    ok: false,
    message: "入力内容を確認してください。",
    redirect_path: null,
    errors: validation.errors,
  }
}

export function build_entry_success_output(input: {
  entry_uuid: string | null
  redirect_path: string
}): EntrySubmitOutput {
  return {
    ok: true,
    message: "登録を受け付けました。",
    redirect_path: input.redirect_path,
    entry_uuid: input.entry_uuid,
  }
}
