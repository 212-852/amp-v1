"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import ChatMessageBubble from "@/components/chat/message_bubble"
import { resolveTypingLabel } from "@/core/chat/rules"
import type {
  ChatMessageRecord,
  ChatRoomMode,
  ChatRoomRecord,
  ChatTypingRecord,
} from "@/core/chat/types"
import { useLocale } from "@/src/components/locale/provider"
import type { Locale } from "@/src/lib/locale"

type ChatRoomPanelProps = {
  initial_room: ChatRoomRecord
  initial_messages: ChatMessageRecord[]
  initial_typing: ChatTypingRecord[]
  participant_uuid: string
}

export default function ChatRoomPanel({
  initial_room,
  initial_messages,
  initial_typing,
  participant_uuid,
}: Readonly<ChatRoomPanelProps>) {
  const { locale } = useLocale()
  const [room, set_room] = useState(initial_room)
  const [messages, set_messages] = useState(initial_messages)
  const [typing, set_typing] = useState(initial_typing)
  const bottom_ref = useRef<HTMLDivElement>(null)

  const refresh = useCallback(async () => {
    const response = await fetch("/api/chat/room", { cache: "no-store" })

    if (!response.ok) {
      return
    }

    const payload = (await response.json()) as {
      room: ChatRoomRecord
      messages: ChatMessageRecord[]
      typing: ChatTypingRecord[]
    }

    set_room(payload.room)
    set_messages(payload.messages)
    set_typing(
      payload.typing.filter(
        (entry) => entry.participant_uuid !== participant_uuid,
      ),
    )
  }, [participant_uuid])

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

  const typing_label =
    typing.length > 0
      ? resolveTypingLabel(
          (room.locale as Locale) ?? "ja",
          typing[0]?.display_name ?? "Guest",
        )
      : null

  return (
    <section className="rounded-[30px] bg-[#fdfaf6] px-4 py-4 shadow-[inset_0_0_0_1px_#dcc7aa]">
      <div className="max-h-[280px] space-y-3 overflow-y-auto pr-1">
        {messages.map((message) => (
          <ChatMessageBubble key={message.message_uuid} message={message} />
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
