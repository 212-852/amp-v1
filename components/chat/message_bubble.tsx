"use client"

import Image from "next/image"
import { useState } from "react"

import FlexMessage from "@/components/chat/flex"
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

  const body = show_original
    ? resolveMessageBodyOriginal(message)
    : resolveMessageBodyDisplay(message, room_locale)

  if (is_flex) {
    return (
      <div className="m-0 flex w-full items-start gap-2 rounded-none border-0 bg-transparent p-0 shadow-none">
        <div className="relative mt-1 h-8 w-8 shrink-0 overflow-hidden rounded-full bg-white">
          <Image
            src="/images/robo_neko.svg"
            alt=""
            fill
            className="object-contain p-1"
            sizes="32px"
          />
        </div>
        <FlexMessage payload={message.payload} />
      </div>
    )
  }

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
        ].join(" ")}
      >
        <p>{body}</p>
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
