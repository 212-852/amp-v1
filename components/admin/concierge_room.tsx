"use client"

import { ArrowLeft, List } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

import ChatMessageInput from "@/components/chat/message_input"
import ChatRoomPanel from "@/components/chat/room_panel"
import type { ChatRoomState } from "@/core/chat/types"
import { useLocale } from "@/src/components/locale/provider"

const content = {
  back: {
    ja: "戻る",
    en: "Back",
    es: "Volver",
  },
  list: {
    ja: "一覧へ",
    en: "List",
    es: "Lista",
  },
}

const icon_button_class =
  "flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-900 transition hover:bg-neutral-50 active:bg-neutral-100"

export default function AdminConciergeRoom({
  state,
  viewer_display_name,
}: Readonly<{
  state: ChatRoomState
  viewer_display_name?: string | null
}>) {
  const router = useRouter()
  const { locale } = useLocale()

  useEffect(() => {
    const body = JSON.stringify({
      room_uuid: state.room.room_uuid,
      action: "enter",
    })

    void fetch("/api/chat/presence", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body,
      cache: "no-store",
    })

    return () => {
      void fetch("/api/chat/presence", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          room_uuid: state.room.room_uuid,
          action: "leave",
        }),
        cache: "no-store",
      })
    }
  }, [state.room.room_uuid])

  return (
    <section className="flex min-h-0 flex-1 flex-col [--chat-message-bottom-padding:88px]">
      <div className="flex shrink-0 items-center justify-between py-1">
        <button
          type="button"
          aria-label={content.back[locale]}
          onClick={() => router.back()}
          className={icon_button_class}
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
        </button>
        <Link
          href="/admin/list"
          aria-label={content.list[locale]}
          className={icon_button_class}
        >
          <List aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
        </Link>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        <ChatRoomPanel
          initial_room={state.room}
          initial_messages={state.messages}
          initial_presence={state.presence}
          participant_uuid={state.participant.participant_uuid}
          viewer_display_name={viewer_display_name}
          room_uuid={state.room.room_uuid}
          show_presence
          fill_height
        />
      </div>

      <ChatMessageInput locale={locale} room_uuid={state.room.room_uuid} />
    </section>
  )
}
