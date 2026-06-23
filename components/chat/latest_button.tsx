"use client"

import { ArrowDown } from "lucide-react"
import { type RefObject, useEffect } from "react"

import {
  scroll_to_latest,
  should_hide_latest_button,
  type ChatScrollView,
} from "@/components/chat/scroll"
import type { Locale } from "@/src/lib/locale"

const content = {
  scroll_latest: {
    ja: "最新へ",
    en: "Latest",
    es: "Reciente",
  },
} satisfies Record<string, Record<Locale, string>>

type ChatLatestButtonProps = {
  container_ref: RefObject<HTMLElement | null>
  bottom_anchor_ref: RefObject<HTMLElement | null>
  placement?: "panel" | "above_input"
  view: ChatScrollView
  locale: Locale
  visible: boolean
  on_hide: () => void
}

export default function ChatLatestButton({
  container_ref,
  bottom_anchor_ref,
  placement = "panel",
  view,
  locale,
  visible,
  on_hide,
}: Readonly<ChatLatestButtonProps>) {
  function jump_to_latest() {
    scroll_to_latest(
      {
        scroll_container: container_ref.current,
        bottom_anchor: bottom_anchor_ref.current,
        view,
      },
      "manual_latest",
    )
    on_hide()
  }

  useEffect(() => {
    const container = container_ref.current

    if (!container) {
      return
    }

    function update_visibility() {
      const scroll_container = container_ref.current

      if (!scroll_container) {
        return
      }

      if (should_hide_latest_button(scroll_container)) {
        on_hide()
      }
    }

    const frame = window.requestAnimationFrame(update_visibility)

    container.addEventListener("scroll", update_visibility, {
      passive: true,
    })
    window.addEventListener("resize", update_visibility)

    return () => {
      window.cancelAnimationFrame(frame)
      container.removeEventListener("scroll", update_visibility)
      window.removeEventListener("resize", update_visibility)
    }
  }, [container_ref, on_hide])

  if (!visible) {
    return null
  }

  const button = (
    <button
      type="button"
      aria-label="Scroll to latest message"
      onClick={jump_to_latest}
      className={[
        "inline-flex h-9 items-center justify-center gap-1.5 rounded-full bg-black/70 px-3 text-[12px] font-medium text-white shadow-sm transition hover:bg-black/80 active:scale-95",
        placement === "panel" ? "absolute right-3 top-3 z-20" : "",
      ].join(" ")}
    >
      <ArrowDown aria-hidden="true" className="h-4 w-4" />
      <span>{content.scroll_latest[locale]}</span>
    </button>
  )

  if (placement === "above_input") {
    return (
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--chat-composer-height,var(--chat-input-height,120px))+env(safe-area-inset-bottom,0px)+12px)] z-30 px-4">
        <div className="content_container flex w-full justify-end">
          <div className="pointer-events-auto">{button}</div>
        </div>
      </div>
    )
  }

  return button
}
