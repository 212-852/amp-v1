"use client"

import { ArrowDown } from "lucide-react"
import {
  type RefObject,
  useEffect,
  useState,
} from "react"

import {
  CHAT_NEAR_BOTTOM_THRESHOLD,
  read_distance_from_bottom,
  scroll_chat_to_bottom,
  type ChatScrollView,
} from "@/components/chat/scroll_to_bottom"

type ChatScrollButtonProps = {
  container_ref: RefObject<HTMLElement | null>
  bottom_ref: RefObject<HTMLElement | null>
  placement?: "panel" | "above_input"
  view: ChatScrollView
}

export default function ChatScrollButton({
  container_ref,
  bottom_ref,
  placement = "panel",
  view,
}: Readonly<ChatScrollButtonProps>) {
  const [is_visible, set_is_visible] = useState(false)

  function jump_to_bottom() {
    const container = container_ref.current

    if (!container) {
      return
    }

    scroll_chat_to_bottom({
      scroll_container: container,
      bottom_anchor: bottom_ref.current,
      reason: "manual_jump",
      view,
    })
    window.dispatchEvent(
      new CustomEvent("amp-chat-scroll-bottom", {
        detail: { reason: "manual_jump", force: true },
      }),
    )
  }

  useEffect(() => {
    const container = container_ref.current

    if (!container) {
      return
    }

    const scroll_container = container

    function update_visibility() {
      set_is_visible(
        read_distance_from_bottom(scroll_container) > CHAT_NEAR_BOTTOM_THRESHOLD,
      )
    }

    const frame = window.requestAnimationFrame(update_visibility)

    scroll_container.addEventListener("scroll", update_visibility, {
      passive: true,
    })
    window.addEventListener("resize", update_visibility)

    return () => {
      window.cancelAnimationFrame(frame)
      scroll_container.removeEventListener("scroll", update_visibility)
      window.removeEventListener("resize", update_visibility)
    }
  }, [container_ref])

  if (!is_visible) {
    return null
  }

  const button = (
    <button
      type="button"
      aria-label="Scroll to latest message"
      onClick={jump_to_bottom}
      className={[
        "inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/70 text-white shadow-sm transition hover:bg-black/80 active:scale-95",
        placement === "panel" ? "absolute right-3 top-3 z-20" : "",
      ].join(" ")}
    >
      <ArrowDown aria-hidden="true" className="h-4 w-4" />
    </button>
  )

  if (placement === "above_input") {
    return (
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--chat-composer-height,var(--chat-input-height,120px))+env(safe-area-inset-bottom,0px)+12px)] z-30 px-4">
        <div className="mx-auto flex w-full max-w-[430px] justify-end">
          <div className="pointer-events-auto">{button}</div>
        </div>
      </div>
    )
  }

  return button
}
