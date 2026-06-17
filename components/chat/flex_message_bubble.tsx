"use client"

import Image from "next/image"

import { useOverlay } from "@/components/overlay"
import { isQuickMenuTriggerAction, readFlexCarouselBubbles } from "@/core/chat/flex"
import type { ChatMessageRecord } from "@/core/chat/types"

async function requestQuickMenu() {
  await fetch("/api/chat/room", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ trigger: "quick_menu_requested" }),
  }).catch(() => null)

  window.dispatchEvent(new CustomEvent("amp-chat-message-created"))
}

export default function FlexMessageBubble({
  message,
}: Readonly<{
  message: ChatMessageRecord
}>) {
  const { openOverlay } = useOverlay()
  const bubbles = readFlexCarouselBubbles(message.payload)

  if (bubbles.length === 0) {
    return null
  }

  function handleAction(action: string) {
    if (isQuickMenuTriggerAction(action)) {
      void requestQuickMenu()
      return
    }

    if (action === "support") {
      openOverlay({ type: "menu", source: "user" })
    }
  }

  return (
    <div className="w-full min-w-0 overflow-x-auto overscroll-x-contain rounded-none border-0 bg-transparent p-0 shadow-none [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex w-max snap-x snap-mandatory gap-2">
        {bubbles.map((bubble, index) => {
          const title = bubble.texts[0] ?? ""
          const body = bubble.texts.slice(1).join("\n")

          return (
            <article
              key={`${title}-${index}`}
              className="w-[260px] shrink-0 snap-start overflow-hidden rounded-[12px] bg-white shadow-[0_2px_6px_rgba(0,0,0,0.1)]"
            >
              {bubble.image_url ? (
                <div className="relative aspect-[20/13] w-full bg-[#f3e7d7]">
                  <Image
                    src={bubble.image_url}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="260px"
                  />
                </div>
              ) : null}
              <div className="px-4 py-3">
                {title ? (
                  <p className="text-[15px] font-bold leading-snug text-[#3D2A19]">
                    {title}
                  </p>
                ) : null}
                {body ? (
                  <p className="mt-2 text-[13px] leading-relaxed text-[#8C7358]">
                    {body}
                  </p>
                ) : null}
              </div>
              {bubble.buttons.length > 0 ? (
                <div className="flex flex-col gap-2 px-3 pb-3">
                  {bubble.buttons.map((button) => (
                    <button
                      key={`${button.label}-${button.data}`}
                      type="button"
                      onClick={() => handleAction(button.data)}
                      className="h-[40px] rounded-[4px] bg-[#8F5D28] text-[14px] font-medium text-white"
                    >
                      {button.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </article>
          )
        })}
      </div>
    </div>
  )
}
