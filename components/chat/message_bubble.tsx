"use client"

import Image from "next/image"
import { useState } from "react"

import { isQuickMenuTriggerAction, readFlexCarouselCards } from "@/core/chat/flex"
import {
  hasMessageTranslation,
  resolveMessageBodyDisplay,
  resolveMessageBodyOriginal,
} from "@/core/chat/rules"
import type { ChatMessageRecord } from "@/core/chat/types"
import { useLocale } from "@/src/components/locale/provider"
import type { Locale } from "@/src/lib/locale"

const content = {
  show_original: {
    ja: "原文",
    en: "Original",
    es: "Original",
  },
  show_translation: {
    ja: "翻訳",
    en: "Translated",
    es: "Traduccion",
  },
}

async function requestCarouselAction(action: string) {
  if (!isQuickMenuTriggerAction(action)) {
    return
  }

  await fetch("/api/chat/room", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ trigger: "quick_menu_requested" }),
  }).catch(() => null)

  window.dispatchEvent(new CustomEvent("amp-chat-message-created"))
}

export default function ChatMessageBubble({
  message,
  room_locale = "ja",
}: Readonly<{
  message: ChatMessageRecord
  room_locale?: Locale
}>) {
  const { locale } = useLocale()
  const can_toggle = hasMessageTranslation(message, room_locale)
  const [show_original, set_show_original] = useState(false)
  const is_system = message.type === "system"
  const is_flex = message.type === "flex"
  const flex_cards = is_flex
    ? readFlexCarouselCards(message.payload, room_locale)
    : []

  const body = show_original
    ? resolveMessageBodyOriginal(message)
    : resolveMessageBodyDisplay(message, room_locale)

  return (
    <div
      className={[
        "flex w-full",
        is_system ? "justify-center" : "justify-start",
      ].join(" ")}
    >
      <div
        className={[
          "max-w-[85%] rounded-[22px] px-4 py-4 text-[14px] leading-relaxed",
          is_system
            ? "bg-[#ead7c3]/70 text-[#8c7358]"
            : "bg-[#fdfaf6] text-[#3d2a19] shadow-[0_4px_12px_rgba(107,74,38,0.08)]",
          is_flex ? "w-full max-w-full px-3" : "",
        ].join(" ")}
      >
        {is_flex && flex_cards.length > 0 ? (
          <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1">
            {flex_cards.map((card) => (
              <article
                key={card.key}
                className="w-[220px] shrink-0 snap-center overflow-hidden rounded-[18px] bg-white shadow-[inset_0_0_0_1px_#ead7c3]"
              >
                {card.image_url ? (
                  <div className="relative h-[132px] w-full overflow-hidden bg-[#f3e7d7]">
                    <Image
                      src={card.image_url}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="220px"
                    />
                  </div>
                ) : null}
                <div className="space-y-2 px-4 py-3">
                  <h3 className="text-[14px] font-bold leading-snug text-[#3d2a19]">
                    {card.title}
                  </h3>
                  <p className="text-[12px] leading-relaxed text-[#8c7358]">
                    {card.body}
                  </p>
                  {card.buttons.length > 0 ? (
                    <div className="flex flex-col gap-2 pt-1">
                      {card.buttons.map((button) => (
                        <button
                          key={`${button.label}-${button.action}`}
                          type="button"
                          onClick={() => {
                            void requestCarouselAction(button.action)
                          }}
                          className="h-9 rounded-full bg-[#8f5d28] px-4 text-[12px] font-bold text-[#fdfaf6]"
                        >
                          {button.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p>{body}</p>
        )}
        {can_toggle && !is_system && !is_flex ? (
          <button
            type="button"
            onClick={() => set_show_original((current) => !current)}
            className="mt-2 text-[11px] font-semibold text-[#8f5d28]"
          >
            {show_original
              ? content.show_translation[locale as Locale]
              : content.show_original[locale as Locale]}
          </button>
        ) : null}
      </div>
    </div>
  )
}
