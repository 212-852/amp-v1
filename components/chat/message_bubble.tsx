"use client"

import { useEffect, useState, useSyncExternalStore } from "react"

import FlexMessage from "@/components/chat/flex"
import { send_chat_realtime_debug } from "@/components/chat/realtime_debug"
import {
  hasMessageTranslation,
  readMessageMeta,
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
    ja: "Staff",
    en: "Staff",
    es: "Staff",
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

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function formatBubbleMessageTime(created_at: string) {
  const date = new Date(created_at)

  if (Number.isNaN(date.getTime())) {
    return ""
  }

  const hour = String(date.getHours()).padStart(2, "0")
  const minute = String(date.getMinutes()).padStart(2, "0")
  const time = `${hour}:${minute}`
  const today = startOfLocalDay(new Date())
  const message_day = startOfLocalDay(date)
  const diff_days = Math.round(
    (today.getTime() - message_day.getTime()) / 86400000,
  )

  if (diff_days === 0) {
    return time
  }

  if (diff_days === 1) {
    return `Yesterday ${time}`
  }

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")

  return `${year}/${month}/${day} ${time}`
}

function formatPresenceSystemDateTime(created_at: string) {
  const date = new Date(created_at)

  if (Number.isNaN(date.getTime())) {
    return ""
  }

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  const hour = String(date.getHours()).padStart(2, "0")
  const minute = String(date.getMinutes()).padStart(2, "0")

  return `${year}/${month}/${day} ${hour}:${minute}`
}

function isPresenceSystemMessage(message: ChatMessageRecord) {
  const meta = readMessageMeta(message.payload)

  return meta.presence_action === "enter" || meta.presence_action === "leave"
}

function subscribeMounted(listener: () => void) {
  const timer = window.setTimeout(listener, 0)

  return () => {
    window.clearTimeout(timer)
  }
}

function getMountedSnapshot() {
  return true
}

function getServerMountedSnapshot() {
  return false
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

function resolveActorDisplayName(message: ChatMessageRecord) {
  const actor_display_name = readMessageMeta(message.payload).actor_display_name
  const normalized =
    typeof actor_display_name === "string" ? actor_display_name.trim() : ""

  return normalized || null
}

function resolveAvatarInitials(
  kind: ChatMessageKind,
  viewer_display_name: string | null,
  actor_display_name: string | null,
) {
  if (kind === "concierge") {
    const concierge_name = actor_display_name?.trim()

    if (concierge_name) {
      return concierge_name.slice(0, 2).toUpperCase()
    }

    return "C"
  }

  const name = actor_display_name?.trim() || viewer_display_name?.trim() || "Guest"
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
  actor_display_name,
}: Readonly<{
  kind: ChatMessageKind
  created_at: string
  locale: Locale
  align: "left" | "right"
  actor_display_name?: string | null
}>) {
  const is_mounted = useSyncExternalStore(
    subscribeMounted,
    getMountedSnapshot,
    getServerMountedSnapshot,
  )
  const time = is_mounted ? formatMessageTime(created_at) : ""

  return (
    <div
      className={[
        "mb-1 flex items-center gap-2 text-[11px] leading-none text-[#8c7358]",
        align === "right" ? "justify-end" : "justify-start",
      ].join(" ")}
    >
      <span className="font-semibold text-[#6f5842]">
        {actor_display_name?.trim() || resolveSenderLabel(kind, locale)}
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
  show_header = true,
}: Readonly<{
  message: ChatMessageRecord
  room_locale?: Locale
  viewer_display_name?: string | null
  show_header?: boolean
}>) {
  const { locale } = useLocale()
  const active_locale = locale as Locale
  const is_mounted = useSyncExternalStore(
    subscribeMounted,
    getMountedSnapshot,
    getServerMountedSnapshot,
  )
  const can_toggle = hasMessageTranslation(message, room_locale)
  const [show_original, set_show_original] = useState(false)
  const source_kind = readMessageSourceKind(message)
  const is_system = message.type === "system"
  const is_flex = message.type === "flex"
  const is_user = source_kind === "user"
  const is_concierge = source_kind === "concierge"
  const align = is_user ? "right" : "left"
  const actor_display_name = resolveActorDisplayName(message)
  const rendered_time = is_mounted
    ? formatBubbleMessageTime(message.created_at)
    : ""

  const body = show_original
    ? resolveMessageBodyOriginal(message)
    : resolveMessageBodyDisplay(message, room_locale)

  useEffect(() => {
    if (!rendered_time) {
      return
    }

    send_chat_realtime_debug("chat_message_rendered", {
      message_uuid: message.message_uuid,
      created_at: message.created_at,
      rendered_time,
      sender_type: source_kind,
    })
  }, [message.created_at, message.message_uuid, rendered_time, source_kind])

  if (is_system) {
    const is_presence = isPresenceSystemMessage(message)
    const presence_time = is_mounted
      ? formatPresenceSystemDateTime(message.created_at)
      : ""

    return (
      <div className="flex w-full justify-center">
        <div
          className={[
            "max-w-[85%] rounded-[22px] px-4 py-3 text-center text-[13px] leading-relaxed",
            is_presence
              ? "bg-neutral-100 text-neutral-600"
              : "bg-[#ead7c3]/70 text-[#8c7358]",
          ].join(" ")}
        >
          <p>{body}</p>
          {is_presence && presence_time ? (
            <p className="mt-1 text-[11px] font-medium text-neutral-500">
              {presence_time}
            </p>
          ) : null}
        </div>
      </div>
    )
  }

  const bubble_class = is_user
    ? "bg-[#f3e2c7] text-[#3d2a19]"
    : "bg-white text-[#3d2a19]"

  if (is_flex) {
    return (
      <div className="relative flex w-full justify-start overflow-visible pt-0">
        <div className="w-full min-w-0 max-w-full">
          {show_header ? (
            <MessageHeader
              kind={source_kind}
              created_at={message.created_at}
              locale={active_locale}
              align={align}
              actor_display_name={actor_display_name}
            />
          ) : null}
          <FlexMessage payload={message.payload} />
        </div>
      </div>
    )
  }

  const text_bubble = (
    <div
      className={[
        "max-w-full rounded-[18px] px-4 py-3 text-[14px] leading-relaxed",
        bubble_class,
      ].join(" ")}
    >
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
      {rendered_time ? (
        <span
          className={[
            "mt-1 block text-[10px] font-medium leading-none text-[#8c7358]",
            is_user ? "text-right" : "text-left",
          ].join(" ")}
        >
          {rendered_time}
        </span>
      ) : null}
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
        {show_header ? (
          <MessageHeader
            kind={source_kind}
            created_at={message.created_at}
            locale={active_locale}
            align={align}
            actor_display_name={actor_display_name}
          />
        ) : null}

        {is_user ? (
          <div className="flex items-start justify-end gap-2">
            {text_bubble}
            <MessageAvatar
              initials={resolveAvatarInitials(
                source_kind,
                viewer_display_name,
                actor_display_name,
              )}
            />
          </div>
        ) : is_concierge ? (
          <div className="flex items-start gap-2">
            <MessageAvatar
              initials={resolveAvatarInitials(
                source_kind,
                viewer_display_name,
                actor_display_name,
              )}
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
