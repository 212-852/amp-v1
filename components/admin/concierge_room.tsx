"use client"

import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { useEffect } from "react"

import ChatMessageInput from "@/components/chat/message_input"
import ChatRoomPanel from "@/components/chat/room_panel"
import { ADMIN_QUEUE_REFRESH_EVENT } from "@/components/admin/concierge_queue"
import type { ChatRoomState } from "@/core/chat/types"
import type { ConciergeQueueRoom } from "@/core/concierge/message"
import { useLocale } from "@/src/components/locale/provider"

const icon_button_class =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-900 transition hover:bg-neutral-50 active:bg-neutral-100"

function resolveInitials(value: string | null | undefined) {
  const normalized = value?.trim()

  if (!normalized) {
    return "G"
  }

  const parts = normalized.split(/\s+/).filter(Boolean)

  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase()
  }

  return normalized.slice(0, 2).toUpperCase()
}

function RoomHeader({
  customer,
  mode,
}: Readonly<{
  customer: ConciergeQueueRoom | null
  mode: ChatRoomState["room"]["mode"]
}>) {
  const display_name = customer?.display_name?.trim() || "Guest"
  const avatar_url = customer?.avatar_url ?? null
  const status = mode === "concierge" ? "Concierge" : mode === "bot" ? "Bot" : mode

  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-neutral-200 bg-neutral-50 py-1.5">
      <Link
        href="/admin/list"
        aria-label="Back to chat list"
        className={icon_button_class}
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
      </Link>

      <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-neutral-100">
        {avatar_url ? (
          <img
            src={avatar_url}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-[11px] font-semibold text-neutral-700">
            {resolveInitials(display_name)}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold text-neutral-950">
          {display_name}
        </p>
        <p className="mt-0.5 truncate text-[12px] font-medium text-neutral-500">
          {status}
        </p>
      </div>
    </div>
  )
}

export default function AdminConciergeRoom({
  state,
  viewer_display_name,
  customer_header,
}: Readonly<{
  state: ChatRoomState
  viewer_display_name?: string | null
  customer_header?: ConciergeQueueRoom | null
}>) {
  const { locale } = useLocale()

  useEffect(() => {
    const body = JSON.stringify({
      room_uuid: state.room.room_uuid,
      action: "enter",
    })

    function notify_queue_refresh() {
      window.dispatchEvent(new CustomEvent(ADMIN_QUEUE_REFRESH_EVENT))
    }

    void fetch("/api/chat/presence", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body,
      cache: "no-store",
    })
      .then((response) => {
        if (response.ok) {
          notify_queue_refresh()
        }
      })
      .catch(() => null)

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
        .then((response) => {
          if (response.ok) {
            notify_queue_refresh()
          }
        })
        .catch(() => null)
    }
  }, [state.room.room_uuid])

  return (
    <div className="flex min-h-0 flex-1 flex-col [--chat-composer-height:80px] [--chat-input-height:80px] [--chat-message-bottom-padding:calc(var(--chat-composer-height)+env(safe-area-inset-bottom,0px)+32px)]">
      <RoomHeader
        customer={customer_header ?? null}
        mode={state.room.mode}
      />

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
          scroll_button_placement="above_input"
        />
      </div>

      <ChatMessageInput
        locale={locale}
        room_uuid={state.room.room_uuid}
        participant_uuid={state.participant.participant_uuid}
      />
    </div>
  )
}
