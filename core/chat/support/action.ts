import type { ChatSupportAccess } from "@/core/chat/support/rules"

export type ChatSupportMode = "bot" | "concierge"

export type ChatSupportSwitchInput = {
  requested_mode: ChatSupportMode
  current_mode: ChatSupportMode
  access: ChatSupportAccess
}

export type ChatSupportSwitchResult =
  | {
      outcome: "switch"
      mode: ChatSupportMode
      show_member_modal: false
    }
  | {
      outcome: "stay"
      mode: ChatSupportMode
      show_member_modal: true
    }
  | {
      outcome: "stay"
      mode: ChatSupportMode
      show_member_modal: false
    }

export function applyChatSupportSwitch(
  input: ChatSupportSwitchInput,
): ChatSupportSwitchResult {
  if (input.requested_mode === input.current_mode) {
    return {
      outcome: "stay",
      mode: input.current_mode,
      show_member_modal: false,
    }
  }

  if (input.requested_mode === "bot") {
    return {
      outcome: "switch",
      mode: "bot",
      show_member_modal: false,
    }
  }

  if (input.access.concierge.enabled) {
    return {
      outcome: "switch",
      mode: "concierge",
      show_member_modal: false,
    }
  }

  return {
    outcome: "stay",
    mode: "bot",
    show_member_modal: true,
  }
}
