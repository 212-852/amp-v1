"use client"

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
    <section className="flex min-h-[calc(100dvh-120px)] flex-col gap-3 pb-24">
      <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="text-[13px] font-medium text-neutral-600 transition hover:text-neutral-950 active:text-neutral-800"
        >
          {content.back[locale]}
        </button>
        <Link
          href="/admin/concierge"
          className="text-[13px] font-medium text-neutral-600 transition hover:text-neutral-950 active:text-neutral-800"
        >
          {content.list[locale]}
        </Link>
      </div>

      <ChatRoomPanel
        initial_room={state.room}
        initial_messages={state.messages}
        initial_presence={state.presence}
        participant_uuid={state.participant.participant_uuid}
        viewer_display_name={viewer_display_name}
        room_uuid={state.room.room_uuid}
        show_presence
      />

      <ChatMessageInput locale={locale} room_uuid={state.room.room_uuid} />
    </section>
  )
}
