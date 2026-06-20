"use client"

import { send_chat_realtime_debug } from "@/components/chat/realtime_debug"

export const CHAT_NEAR_BOTTOM_THRESHOLD = 160

export const CHAT_BOTTOM_SPACER_HEIGHT =
  "calc(var(--chat-composer-height, var(--chat-input-height, 88px)) + env(safe-area-inset-bottom, 0px) + 48px)"

export type ChatScrollReason =
  | "initial_load"
  | "own_send"
  | "optimistic_append"
  | "realtime_receive"
  | "input_resize"
  | "composer_mount"
  | "composer_resize"
  | "message_archived"
  | "manual_jump"
  | "typing"
  | "room_change"

export type ChatScrollView = "user" | "concierge"

export function read_distance_from_bottom(container: HTMLElement) {
  return container.scrollHeight - container.scrollTop - container.clientHeight
}

export function is_chat_near_bottom(container: HTMLElement) {
  return read_distance_from_bottom(container) < CHAT_NEAR_BOTTOM_THRESHOLD
}

export function scroll_chat_to_bottom(input: {
  scroll_container: HTMLElement
  bottom_anchor: HTMLElement | null
  reason: ChatScrollReason
  view: ChatScrollView
}) {
  const container = input.scroll_container
  const scroll_top = container.scrollTop
  const scroll_height = container.scrollHeight
  const client_height = container.clientHeight
  const distance_from_bottom = read_distance_from_bottom(container)

  send_chat_realtime_debug("chat_scroll_to_bottom_called", {
    reason: input.reason,
    view: input.view,
    scroll_top,
    scroll_height,
    client_height,
    distance_from_bottom,
  })

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      if (input.bottom_anchor) {
        input.bottom_anchor.scrollIntoView({ block: "end" })
      } else {
        container.scrollTo({ top: container.scrollHeight })
      }

      send_chat_realtime_debug("chat_scroll_to_bottom_done", {
        reason: input.reason,
        view: input.view,
        distance_from_bottom_after: read_distance_from_bottom(container),
      })
    })
  })
}

export function request_chat_scroll_to_bottom(input: {
  scroll_container: HTMLElement | null
  bottom_anchor: HTMLElement | null
  reason: ChatScrollReason
  view: ChatScrollView
  force?: boolean
  is_near_bottom?: boolean
}) {
  if (!input.scroll_container) {
    return
  }

  if (
    !input.force &&
    input.reason === "realtime_receive" &&
    !input.is_near_bottom
  ) {
    return
  }

  scroll_chat_to_bottom({
    scroll_container: input.scroll_container,
    bottom_anchor: input.bottom_anchor,
    reason: input.reason,
    view: input.view,
  })
}

export type ChatScrollBottomDetail = {
  reason?: ChatScrollReason
  force?: boolean
}

export function read_chat_scroll_bottom_detail(event: Event): ChatScrollBottomDetail {
  const detail = (event as CustomEvent<ChatScrollBottomDetail>).detail

  return {
    reason: detail?.reason,
    force: detail?.force,
  }
}
