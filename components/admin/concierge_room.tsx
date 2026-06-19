"use client"

import { ArrowLeft, List } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

import ChatMessageInput from "@/components/chat/message_input"
import ChatRoomPanel from "@/components/chat/room_panel"
import type { ChatRoomState } from "@/core/chat/types"
import type { ConciergeQueueRoom } from "@/core/concierge/message"
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

function CustomerHeader({
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
    <div className="flex shrink-0 items-center gap-3 border-b border-neutral-200 bg-neutral-50 py-2">
      <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-neutral-100">
        {avatar_url ? (
          <img
            src={avatar_url}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-[12px] font-semibold text-neutral-700">
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
    <div className="flex min-h-0 flex-1 flex-col [--chat-message-bottom-padding:calc(80px+env(safe-area-inset-bottom,0px))]">
      <CustomerHeader
        customer={customer_header ?? null}
        mode={state.room.mode}
      />
      <div className="flex shrink-0 items-center justify-between border-b border-neutral-200 bg-neutral-50 py-2">
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
          scroll_button_placement="above_input"
        />
      </div>

      <ChatMessageInput locale={locale} room_uuid={state.room.room_uuid} />
    </div>
  )
}
