"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import ChatMessageBubble from "@/components/chat/message_bubble"
import ChatScrollButton from "@/components/chat/scroll"
import { useRoomTyping } from "@/components/chat/use_room_typing"
import { filterUserVisibleChatMessages, resolveTypingLabel } from "@/core/chat/rules"
import { create_browser_supabase_client } from "@/src/lib/supabase/client"
import { useLocale } from "@/src/components/locale/provider"
import type {
  ChatMessageRecord,
  ChatRoomMode,
  ChatRoomRecord,
  PresenceView,
} from "@/core/chat/types"
import type { Locale } from "@/src/lib/locale"

const content = {
  bot_mode: {
    ja: "Botモード",
    en: "Bot mode",
    es: "Modo Bot",
  },
}

type ChatRoomPanelProps = {
  initial_room: ChatRoomRecord
  initial_messages: ChatMessageRecord[]
  initial_presence?: PresenceView[]
  participant_uuid: string
  viewer_display_name?: string | null
  room_uuid?: string | null
  show_presence?: boolean
  fill_height?: boolean
}

export default function ChatRoomPanel({
  initial_room,
  initial_messages,
  initial_presence = [],
  participant_uuid,
  viewer_display_name = null,
  room_uuid = null,
  show_presence = false,
  fill_height = false,
}: Readonly<ChatRoomPanelProps>) {
  const [room, set_room] = useState(initial_room)
  const [messages, set_messages] = useState(initial_messages)
  const [presence, set_presence] = useState(initial_presence)
  const { locale } = useLocale()
  const typing = useRoomTyping({
    room_uuid: room.room_uuid,
    participant_uuid,
  })
  const bottom_ref = useRef<HTMLDivElement>(null)
  const scroll_ref = useRef<HTMLDivElement>(null)

  const refresh = useCallback(async () => {
    const params = new URLSearchParams()

    params.set("locale", locale)

    const scoped_room_uuid = room_uuid ?? (show_presence ? room.room_uuid : null)

    if (scoped_room_uuid) {
      params.set("room_uuid", scoped_room_uuid)
    }

    const query = `?${params.toString()}`
    const response = await fetch(`/api/chat/room${query}`, { cache: "no-store" })

    if (!response.ok) {
      return
    }

    const payload = (await response.json()) as {
      room: ChatRoomRecord | null
      messages: ChatMessageRecord[]
      presence?: PresenceView[]
    }

    if (!payload.room) {
      return
    }

    if (payload.room.mode !== room.mode) {
      window.dispatchEvent(
        new CustomEvent("amp-chat-mode-changed", {
          detail: { mode: payload.room.mode },
        }),
      )
    }

    set_room(payload.room)
    set_messages(payload.messages)

    if (payload.presence) {
      set_presence(payload.presence)
    }
  }, [locale, room.mode, room.room_uuid, room_uuid, show_presence])

  useEffect(() => {
    let supabase: ReturnType<typeof create_browser_supabase_client>

    try {
      supabase = create_browser_supabase_client()
    } catch {
      return
    }

    const channel = supabase
      .channel(`chat_room_panel:${room.room_uuid}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "rooms",
          filter: `room_uuid=eq.${room.room_uuid}`,
        },
        () => {
          void refresh()
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `room_uuid=eq.${room.room_uuid}`,
        },
        () => {
          void refresh()
        },
      )

    if (show_presence) {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "presence",
          filter: `room_uuid=eq.${room.room_uuid}`,
        },
        () => {
          void refresh()
        },
      )
    }

    channel.subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [refresh, room.room_uuid, show_presence])

  useEffect(() => {
    bottom_ref.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages.length, typing.length])

  useEffect(() => {
    function handle_scroll_bottom() {
      bottom_ref.current?.scrollIntoView({ behavior: "smooth" })
    }

    window.addEventListener("amp-chat-scroll-bottom", handle_scroll_bottom)

    return () => {
      window.removeEventListener("amp-chat-scroll-bottom", handle_scroll_bottom)
    }
  }, [])

  useEffect(() => {
    function handle_mode_change(event: Event) {
      const detail = (event as CustomEvent<{ mode: ChatRoomMode }>).detail

      if (detail?.mode) {
        set_room((current) => ({ ...current, mode: detail.mode }))
        void refresh()
      }
    }

    window.addEventListener("amp-chat-mode-changed", handle_mode_change)

    return () => {
      window.removeEventListener("amp-chat-mode-changed", handle_mode_change)
    }
  }, [refresh])

  useEffect(() => {
    function handle_message_created() {
      void refresh()
    }

    window.addEventListener("amp-chat-message-created", handle_message_created)

    return () => {
      window.removeEventListener(
        "amp-chat-message-created",
        handle_message_created,
      )
    }
  }, [refresh])

  const typing_label =
    typing.length > 0
      ? resolveTypingLabel(
          (room.locale as Locale) ?? "ja",
          typing[0]?.display_name ?? "Guest",
        )
      : null

  const visible_messages = show_presence
    ? messages
    : filterUserVisibleChatMessages(messages)

  const scroll_class = fill_height
    ? "h-full space-y-4 overflow-y-auto pt-0 pb-[var(--chat-message-bottom-padding,24px)]"
    : "max-h-[calc(100dvh-220px)] space-y-4 overflow-y-auto pt-0 pb-[var(--chat-message-bottom-padding,24px)]"

  return (
    <section
      className={[
        "relative rounded-none bg-transparent p-0 shadow-none",
        fill_height ? "flex h-full min-h-0 flex-col" : "",
      ].join(" ")}
    >
      <ChatScrollButton container_ref={scroll_ref} bottom_ref={bottom_ref} />
      {show_presence && room.mode !== "concierge" ? (
        <div className="mb-3 shrink-0 rounded-md border border-neutral-200 bg-white px-3 py-2 text-[12px] font-medium text-neutral-600">
          {room.mode === "bot" ? content.bot_mode[locale] : room.mode}
        </div>
      ) : null}
      {show_presence && presence.length > 0 ? (
        <div className="mb-3 flex shrink-0 flex-wrap gap-2">
          {presence.map((entry) => (
            <span
              key={entry.participant_uuid}
              className="rounded-full bg-neutral-100 px-3 py-1 text-[11px] font-medium text-neutral-600"
            >
              {entry.display_name}
            </span>
          ))}
        </div>
      ) : null}
      <div ref={scroll_ref} className={scroll_class}>
        {visible_messages.map((message) => (
          <ChatMessageBubble
            key={message.message_uuid}
            message={message}
            room_locale={(room.locale as Locale) ?? "ja"}
            viewer_display_name={viewer_display_name}
          />
        ))}
        {typing_label ? (
          <p className="px-2 text-[12px] font-medium text-[#8c7358]">
            {typing_label}
          </p>
        ) : null}
        <div ref={bottom_ref} />
      </div>
    </section>
  )
}
