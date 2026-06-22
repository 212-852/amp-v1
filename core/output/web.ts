import {
  isLineFlexCarouselPayload,
  type LineFlexCarouselPayload,
} from "@/core/bot/rules"
import type { DeliveryResult } from "@/core/output"
import type { ContactRecord } from "@/core/contacts/rules"
import type { OutputMessage } from "@/core/output/rules"

export type WebFlexAction = {
  kind: "quick_menu" | "uri" | "menu" | "noop"
  value: string
}

export function read_web_carousel_payload(
  payload: Record<string, unknown> | null | undefined,
): LineFlexCarouselPayload | null {
  if (!isLineFlexCarouselPayload(payload)) {
    return null
  }

  return payload
}

export function read_web_carousel_from_output(
  message: OutputMessage,
): LineFlexCarouselPayload | null {
  return read_web_carousel_payload(message.data ?? null)
}

export function resolve_web_flex_action(
  action: Record<string, unknown> | null | undefined,
): WebFlexAction {
  if (!action) {
    return { kind: "noop", value: "" }
  }

  const type = typeof action.type === "string" ? action.type : ""
  const uri = typeof action.uri === "string" ? action.uri.trim() : ""
  const data = typeof action.data === "string" ? action.data.trim() : ""
  const label = typeof action.label === "string" ? action.label.trim() : ""

  if (type === "uri" && uri) {
    return { kind: "uri", value: uri }
  }

  if (data === "quick_menu_requested" || data === "quick_menu") {
    return { kind: "quick_menu", value: data }
  }

  if (uri) {
    return { kind: "uri", value: uri }
  }

  if (data) {
    return { kind: "menu", value: data }
  }

  if (label) {
    return { kind: "menu", value: label }
  }

  return { kind: "noop", value: "" }
}

export async function deliverWeb(
  contact: ContactRecord | null,
  message: OutputMessage,
): Promise<DeliveryResult> {
  void contact
  void message

  return { transport: "web", delivered: false }
}
