"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import ChatMessageBubble from "@/components/chat/message_bubble"
import { useRoomTyping } from "@/components/chat/use_room_typing"
import { resolveTypingLabel } from "@/core/chat/rules"
import type {
  ChatMessageRecord,
  ChatRoomMode,
  ChatRoomRecord,
  PresenceView,
} from "@/core/chat/types"
import type { Locale } from "@/src/lib/locale"

type ChatRoomPanelProps = {
  initial_room: ChatRoomRecord
  initial_messages: ChatMessageRecord[]
  initial_presence?: PresenceView[]
  participant_uuid: string
  viewer_display_name?: string | null
  show_presence?: boolean
}

export default function ChatRoomPanel({
  initial_room,
  initial_messages,
  initial_presence = [],
  participant_uuid,
  viewer_display_name = null,
  show_presence = false,
}: Readonly<ChatRoomPanelProps>) {
  const [room, set_room] = useState(initial_room)
  const [messages, set_messages] = useState(initial_messages)
  const [presence, set_presence] = useState(initial_presence)
  const typing = useRoomTyping({
    room_uuid: room.room_uuid,
    participant_uuid,
  })
  const bottom_ref = useRef<HTMLDivElement>(null)

  const refresh = useCallback(async () => {
    const query = show_presence
      ? `?room_uuid=${encodeURIComponent(room.room_uuid)}`
      : ""
    const response = await fetch(`/api/chat/room${query}`, { cache: "no-store" })

    if (!response.ok) {
      return
    }

    const payload = (await response.json()) as {
      room: ChatRoomRecord
      messages: ChatMessageRecord[]
      presence?: PresenceView[]
    }

    set_room(payload.room)
    set_messages(payload.messages)

    if (payload.presence) {
      set_presence(payload.presence)
    }
  }, [room.room_uuid, show_presence])

  useEffect(() => {
    const timer = window.setInterval(() => {
      void refresh()
    }, 4000)

    return () => {
      window.clearInterval(timer)
    }
  }, [refresh])

  useEffect(() => {
    bottom_ref.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages.length, typing.length])

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

  return (
    <section className="rounded-none bg-transparent p-0 shadow-none">
      {show_presence && presence.length > 0 ? (
        <div className="mb-3 flex flex-wrap gap-2">
          {presence.map((entry) => (
            <span
              key={entry.participant_uuid}
              className="rounded-full bg-[#efe4d4] px-3 py-1 text-[11px] font-medium text-[#6f5842]"
            >
              {entry.display_name}
            </span>
          ))}
        </div>
      ) : null}
      <div className="space-y-4">
        {messages.map((message) => (
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
