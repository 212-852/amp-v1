"use client"

import { ArrowDown } from "lucide-react"
import {
  type RefObject,
  useEffect,
  useState,
} from "react"

type ChatScrollButtonProps = {
  container_ref: RefObject<HTMLElement | null>
  bottom_ref: RefObject<HTMLElement | null>
}

export default function ChatScrollButton({
  container_ref,
  bottom_ref,
}: Readonly<ChatScrollButtonProps>) {
  const [is_visible, set_is_visible] = useState(false)

  useEffect(() => {
    const container = container_ref.current

    if (!container) {
      return
    }

    const scroll_container = container

    function update_visibility() {
      const distance_from_bottom =
        scroll_container.scrollHeight -
        scroll_container.scrollTop -
        scroll_container.clientHeight

      set_is_visible(distance_from_bottom > 96)
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

  return (
    <button
      type="button"
      aria-label="Scroll to latest message"
      onClick={() => {
        bottom_ref.current?.scrollIntoView({ behavior: "smooth", block: "end" })
      }}
      className="absolute right-3 top-3 z-20 inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/70 text-white shadow-sm transition hover:bg-black/80 active:scale-95"
    >
      <ArrowDown aria-hidden="true" className="h-4 w-4" />
    </button>
  )
}
