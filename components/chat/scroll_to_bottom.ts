"use client"

import { send_chat_realtime_debug } from "@/components/chat/realtime_debug"

export const CHAT_NEAR_BOTTOM_THRESHOLD = 240

export const CHAT_BOTTOM_SPACER_CLASS = "chat-bottom-spacer"

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

export type ChatScrollTarget = {
  scroll_container: HTMLElement | null
  bottom_anchor: HTMLElement | null
  view: ChatScrollView
  is_near_bottom?: boolean
}

export function read_distance_from_bottom(container: HTMLElement) {
  return container.scrollHeight - container.scrollTop - container.clientHeight
}

export function is_chat_near_bottom(container: HTMLElement) {
  return read_distance_from_bottom(container) < CHAT_NEAR_BOTTOM_THRESHOLD
}

export function scroll_to_latest_message(
  target: ChatScrollTarget,
  reason: ChatScrollReason,
  force = false,
) {
  const container = target.scroll_container

  if (!container) {
    return
  }

  const scroll_height = container.scrollHeight
  const client_height = container.clientHeight
  const distance_from_bottom = read_distance_from_bottom(container)
  const is_near_bottom = target.is_near_bottom ?? is_chat_near_bottom(container)

  if (!force) {
    if (reason === "realtime_receive" && !is_near_bottom) {
      return
    }

    if (reason === "composer_resize" && !is_near_bottom) {
      return
    }
  }

  send_chat_realtime_debug("chat_scroll_called", {
    reason,
    view: target.view,
    force,
    distance_from_bottom,
    scroll_height,
    client_height,
  })

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      target.bottom_anchor?.scrollIntoView({
        block: "end",
        behavior: "smooth",
      })

      send_chat_realtime_debug("chat_scroll_done", {
        reason,
        view: target.view,
        distance_from_bottom_after: read_distance_from_bottom(container),
      })
    })
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

export function build_chat_scroll_target(input: {
  scroll_container: HTMLElement | null
  bottom_anchor: HTMLElement | null
  view: ChatScrollView
  is_near_bottom?: boolean
}): ChatScrollTarget {
  return {
    scroll_container: input.scroll_container,
    bottom_anchor: input.bottom_anchor,
    view: input.view,
    is_near_bottom: input.is_near_bottom,
  }
}
