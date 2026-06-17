"use client"

import { useState } from "react"

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

type WebCard = {
  title?: unknown
  body?: unknown
}

function readWebCards(payload: ChatMessageRecord["payload"]) {
  const web = payload?.web

  if (!web || typeof web !== "object" || Array.isArray(web)) {
    return []
  }

  const cards = (web as { cards?: unknown }).cards

  if (!Array.isArray(cards)) {
    return []
  }

  return cards.filter((card): card is WebCard => {
    return Boolean(card && typeof card === "object" && !Array.isArray(card))
  })
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

  const body = show_original
    ? resolveMessageBodyOriginal(message)
    : resolveMessageBodyDisplay(message, room_locale)
  const is_system = message.type === "system"
  const cards = readWebCards(message.payload)

  return (
    <div
      className={[
        "flex w-full",
        is_system ? "justify-center" : "justify-start",
      ].join(" ")}
    >
      <div
        className={[
          "max-w-[85%] rounded-[22px] px-4 py-3 text-[14px] leading-relaxed",
          is_system
            ? "bg-[#ead7c3]/70 text-[#8c7358]"
            : "bg-[#fdfaf6] text-[#3d2a19] shadow-[0_4px_12px_rgba(107,74,38,0.08)]",
        ].join(" ")}
      >
        <p>{body}</p>
        {cards.length > 0 ? (
          <div className="mt-3 flex snap-x gap-2 overflow-x-auto pb-1">
            {cards.map((card, index) => (
              <article
                key={`${String(card.title ?? "card")}-${index}`}
                className="min-w-[168px] snap-start rounded-[14px] bg-white px-3 py-3 shadow-[inset_0_0_0_1px_#ead7c3]"
              >
                <h3 className="text-[13px] font-semibold leading-snug text-[#3d2a19]">
                  {String(card.title ?? "")}
                </h3>
                <p className="mt-1 text-[12px] leading-relaxed text-[#8c7358]">
                  {String(card.body ?? "")}
                </p>
              </article>
            ))}
          </div>
        ) : null}
        {can_toggle && !is_system ? (
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
