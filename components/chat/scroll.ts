"use client"

import { send_chat_realtime_debug } from "@/components/chat/realtime_debug"

export const CHAT_AWAY_FROM_BOTTOM_THRESHOLD = 120

export const CHAT_BOTTOM_SPACER_CLASS = "chat-bottom-spacer"

export type ChatScrollReason =
  | "initial_load"
  | "optimistic_append"
  | "realtime_receive"
  | "archive_loaded"
  | "room_change"
  | "mode_change"
  | "composer_resize"
  | "content_resize"
  | "manual_latest"

export type ChatScrollView = "user" | "concierge"

export type ChatScrollTarget = {
  scroll_container: HTMLElement | null
  bottom_anchor: HTMLElement | null
  view: ChatScrollView
}

export function read_distance_from_bottom(container: HTMLElement) {
  return container.scrollHeight - container.scrollTop - container.clientHeight
}

export function is_away_from_bottom(container: HTMLElement) {
  return (
    read_distance_from_bottom(container) > CHAT_AWAY_FROM_BOTTOM_THRESHOLD
  )
}

export function should_show_latest_button(container: HTMLElement) {
  return is_away_from_bottom(container)
}

export function should_hide_latest_button(container: HTMLElement) {
  return !is_away_from_bottom(container)
}

export function scroll_to_latest(
  target: ChatScrollTarget,
  reason: ChatScrollReason,
) {
  const scroll_container = target.scroll_container
  const bottom_anchor = target.bottom_anchor

  if (!scroll_container || !bottom_anchor) {
    return
  }

  const container = scroll_container

  send_chat_realtime_debug("chat_scroll_called", {
    reason,
    view: target.view,
    distance_from_bottom: read_distance_from_bottom(container),
    scroll_height: container.scrollHeight,
    client_height: container.clientHeight,
  })

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      bottom_anchor.scrollIntoView({ block: "end" })

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
}

export function read_chat_scroll_bottom_detail(
  event: Event,
): ChatScrollBottomDetail {
  const detail = (event as CustomEvent<ChatScrollBottomDetail>).detail

  return {
    reason: detail?.reason,
  }
}

export function build_chat_scroll_target(input: {
  scroll_container: HTMLElement | null
  bottom_anchor: HTMLElement | null
  view: ChatScrollView
}): ChatScrollTarget {
  return {
    scroll_container: input.scroll_container,
    bottom_anchor: input.bottom_anchor,
    view: input.view,
  }
}
