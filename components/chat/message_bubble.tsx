"use client"

import { useState } from "react"

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
}: Readonly<{
  message: ChatMessageRecord
}>) {
  const { locale } = useLocale()
  const can_toggle =
    message.body_original !== message.body_display ||
    Object.keys(message.translations ?? {}).length > 0
  const [show_original, set_show_original] = useState(false)

  const body = show_original ? message.body_original : message.body_display
  const is_system = message.type === "system"

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
