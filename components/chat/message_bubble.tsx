"use client"

import { useState } from "react"

import FlexMessage from "@/components/chat/flex"
import {
  hasMessageTranslation,
  readMessageSourceKind,
  resolveMessageBodyDisplay,
  resolveMessageBodyOriginal,
} from "@/core/chat/rules"
import type { ChatMessageKind, ChatMessageRecord } from "@/core/chat/types"
import { useLocale } from "@/src/components/locale/provider"
import type { Locale } from "@/src/lib/locale"

const content = {
  bot: {
    ja: "Bot",
    en: "Bot",
    es: "Bot",
  },
  concierge: {
    ja: "Concierge",
    en: "Concierge",
    es: "Concierge",
  },
  you: {
    ja: "You",
    en: "You",
    es: "Tu",
  },
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

function formatMessageTime(created_at: string) {
  const date = new Date(created_at)

  if (Number.isNaN(date.getTime())) {
    return ""
  }

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

function resolveSenderLabel(kind: ChatMessageKind, locale: Locale) {
  if (kind === "concierge") {
    return content.concierge[locale]
  }

  if (kind === "user") {
    return content.you[locale]
  }

  return content.bot[locale]
}

function resolveAvatarInitials(
  kind: ChatMessageKind,
  viewer_display_name: string | null,
) {
  if (kind === "concierge") {
    return "C"
  }

  const name = viewer_display_name?.trim() || "Guest"
  const parts = name.split(/\s+/).filter(Boolean)

  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase()
  }

  return name.slice(0, 2).toUpperCase()
}

function MessageHeader({
  kind,
  created_at,
  locale,
  align,
}: Readonly<{
  kind: ChatMessageKind
  created_at: string
  locale: Locale
  align: "left" | "right"
}>) {
  const time = formatMessageTime(created_at)

  return (
    <div
      className={[
        "mb-1 flex items-center gap-2 text-[11px] leading-none text-[#8c7358]",
        align === "right" ? "justify-end" : "justify-start",
      ].join(" ")}
    >
      <span className="font-semibold text-[#6f5842]">
        {resolveSenderLabel(kind, locale)}
      </span>
      {time ? <span>{time}</span> : null}
    </div>
  )
}

function MessageAvatar({
  initials,
}: Readonly<{
  initials: string
}>) {
  return (
    <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#ead7c3] text-[11px] font-bold text-[#6f5842]">
      {initials}
    </div>
  )
}

export default function ChatMessageBubble({
  message,
  room_locale = "ja",
  viewer_display_name = null,
}: Readonly<{
  message: ChatMessageRecord
  room_locale?: Locale
  viewer_display_name?: string | null
}>) {
  const { locale } = useLocale()
  const active_locale = locale as Locale
  const can_toggle = hasMessageTranslation(message, room_locale)
  const [show_original, set_show_original] = useState(false)
  const source_kind = readMessageSourceKind(message)
  const is_system = message.type === "system"
  const is_flex = message.type === "flex"
  const is_user = source_kind === "user"
  const is_concierge = source_kind === "concierge"
  const align = is_user ? "right" : "left"

  const body = show_original
    ? resolveMessageBodyOriginal(message)
    : resolveMessageBodyDisplay(message, room_locale)

  if (is_system) {
    return (
      <div className="flex w-full justify-center">
        <div className="max-w-[85%] rounded-[22px] bg-[#ead7c3]/70 px-4 py-3 text-center text-[13px] leading-relaxed text-[#8c7358]">
          <p>{body}</p>
        </div>
      </div>
    )
  }

  const bubble_class = is_user
    ? "bg-[#f3e2c7] text-[#3d2a19]"
    : "bg-white text-[#3d2a19]"

  const text_bubble = (
    <div
      className={[
        "rounded-[18px] px-4 py-3 text-[14px] leading-relaxed",
        bubble_class,
        is_flex ? "w-full min-w-0 overflow-hidden p-2" : "max-w-full",
      ].join(" ")}
    >
      {is_flex ? (
        <FlexMessage payload={message.payload} />
      ) : (
        <>
          <p>{body}</p>
          {can_toggle ? (
            <button
              type="button"
              onClick={() => set_show_original((current) => !current)}
              className="mt-2 text-[11px] font-semibold text-[#8f5d28]"
            >
              {show_original
                ? content.show_translation[active_locale]
                : content.show_original[active_locale]}
            </button>
          ) : null}
        </>
      )}
    </div>
  )

  return (
    <div
      className={[
        "flex w-full",
        is_user ? "justify-end" : "justify-start",
      ].join(" ")}
    >
      <div
        className={[
          "min-w-0",
          is_flex ? "w-full max-w-full" : "max-w-[85%]",
        ].join(" ")}
      >
        <MessageHeader
          kind={source_kind}
          created_at={message.created_at}
          locale={active_locale}
          align={align}
        />

        {is_user ? (
          <div className="flex items-start justify-end gap-2">
            {text_bubble}
            <MessageAvatar
              initials={resolveAvatarInitials(source_kind, viewer_display_name)}
            />
          </div>
        ) : is_concierge ? (
          <div className="flex items-start gap-2">
            <MessageAvatar
              initials={resolveAvatarInitials(source_kind, viewer_display_name)}
            />
            {text_bubble}
          </div>
        ) : (
          text_bubble
        )}
      </div>
    </div>
  )
}
