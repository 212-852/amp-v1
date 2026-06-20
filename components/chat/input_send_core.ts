"use client"

import type { RefObject } from "react"

export function prepare_chat_send_text(input: {
  input_value: string
  input_ref: RefObject<HTMLTextAreaElement | HTMLInputElement | null>
  set_input_value: (value: string) => void
}) {
  const text = input.input_value.trim()

  if (!text) {
    return null
  }

  input.set_input_value("")

  if (input.input_ref.current) {
    input.input_ref.current.value = ""
  }

  return text
}
