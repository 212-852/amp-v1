import {
  isLineFlexCarouselPayload,
  type LineFlexCarouselPayload,
} from "@/core/bot/rules"
import type { DeliveryResult } from "@/core/output"
import type { ContactRecord } from "@/core/contacts/rules"
import {
  resolve_web_card_button_style,
  WEB_CARD_HERO_CLASS,
  should_apply_card_hero_fit,
} from "@/core/output/rules"
import type { OutputMessage } from "@/core/output/rules"

export type WebFlexAction = {
  kind: "quick_menu" | "uri" | "menu" | "noop"
  value: string
}

function read_record(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }

  return value as Record<string, unknown>
}

function read_contents(value: unknown) {
  return Array.isArray(value) ? value : []
}

function apply_web_card_node(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => apply_web_card_node(item))
  }

  const record = read_record(value)

  if (!record) {
    return value
  }

  if (record.type === "image" && should_apply_card_hero_fit(record)) {
    return record
  }

  const next: Record<string, unknown> = { ...record }

  for (const [key, child] of Object.entries(record)) {
    if (key === "contents" || key === "footer" || key === "header" || key === "body" || key === "hero") {
      next[key] = apply_web_card_node(child)
    }
  }

  return next
}

export function prepare_web_carousel_payload(
  payload: Record<string, unknown> | null | undefined,
): LineFlexCarouselPayload | null {
  if (!isLineFlexCarouselPayload(payload)) {
    return null
  }

  return {
    type: "carousel",
    contents: payload.contents.map(
      (bubble) => apply_web_card_node(bubble) as Record<string, unknown>,
    ),
  }
}

export function read_web_carousel_payload(
  payload: Record<string, unknown> | null | undefined,
): LineFlexCarouselPayload | null {
  return prepare_web_carousel_payload(payload)
}

export function read_web_carousel_from_output(
  message: OutputMessage,
): LineFlexCarouselPayload | null {
  return read_web_carousel_payload(message.data ?? null)
}

export function resolve_web_flex_button_style(
  node: Record<string, unknown> | null | undefined,
) {
  if (!node) {
    return null
  }

  return resolve_web_card_button_style(node)
}

export function resolve_web_flex_hero_class_name(
  node: Record<string, unknown> | null | undefined,
) {
  if (!node || !should_apply_card_hero_fit(node)) {
    return "block h-auto w-full rounded-t-[18px]"
  }

  return WEB_CARD_HERO_CLASS
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
