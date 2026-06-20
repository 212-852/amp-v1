"use client"

import { type RefObject, useEffect } from "react"

export function useComposerHeightReporter(
  element_ref: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    const node = element_ref.current

    if (!node) {
      return
    }

    function report(reason: "composer_mount" | "composer_resize") {
      const element = element_ref.current

      if (!element) {
        return
      }

      const height = Math.ceil(element.getBoundingClientRect().height)

      document.documentElement.style.setProperty(
        "--chat-composer-height",
        `${height}px`,
      )
      window.dispatchEvent(
        new CustomEvent("amp-chat-input-resized", {
          detail: { reason },
        }),
      )
      window.dispatchEvent(
        new CustomEvent("amp-chat-composer-mounted", {
          detail: { height, reason },
        }),
      )
    }

    report("composer_mount")

    const observer = new ResizeObserver(() => {
      report("composer_resize")
    })
    observer.observe(node)

    return () => {
      observer.disconnect()
    }
  }, [element_ref])
}
