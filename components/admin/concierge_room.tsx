"use client"

import Link from "next/link"
import { useEffect } from "react"

import ChatRoomPanel from "@/components/chat/room_panel"
import type { ChatRoomState } from "@/core/chat/types"

export default function AdminConciergeRoom({
  state,
  viewer_display_name,
}: Readonly<{
  state: ChatRoomState
  viewer_display_name?: string | null
}>) {
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
    <section className="flex flex-col gap-3">
      <ChatRoomPanel
        initial_room={state.room}
        initial_messages={state.messages}
        initial_presence={state.presence}
        participant_uuid={state.participant.participant_uuid}
        viewer_display_name={viewer_display_name}
        show_presence
      />

      <div className="flex justify-end">
        <Link
          href="/admin/concierge"
          className="text-[12px] font-medium text-neutral-500 transition hover:text-neutral-900 active:text-neutral-700"
        >
          一覧へ
        </Link>
      </div>
    </section>
  )
}
