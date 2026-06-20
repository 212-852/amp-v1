"use client"

import { useEffect } from "react"

import ChatRoomPanel from "@/components/chat/room_panel"
import { send_chat_realtime_debug } from "@/components/chat/realtime_debug"
import { useChatRoomBootstrap } from "@/components/chat/use_chat_room_bootstrap"
import type { ChatRoomState } from "@/core/chat/types"
import { useLocale } from "@/src/components/locale/provider"

const content = {
  loading: {
    ja: "チャットを読み込んでいます",
    en: "Loading chat",
    es: "Cargando chat",
  },
  retry: {
    ja: "チャットを再読み込み",
    en: "Retry chat",
    es: "Reintentar chat",
  },
}

function ChatLoadingState({
  retry = null,
}: Readonly<{
  retry?: (() => void) | null
}>) {
  const { locale } = useLocale()

  return (
    <section className="px-2 pt-2">
      {retry ? (
        <button
          type="button"
          onClick={retry}
          className="inline-flex rounded-full bg-white/60 px-4 py-2 text-[13px] font-medium text-[#8c7358]"
        >
          {content.retry[locale]}
        </button>
      ) : (
        <div className="inline-flex rounded-full bg-white/60 px-4 py-2 text-[13px] font-medium text-[#8c7358]">
          {content.loading[locale]}
        </div>
      )}
    </section>
  )
}

export default function AppChatSection({
  chat_state: initial_chat_state,
  viewer_display_name = null,
}: Readonly<{
  chat_state: ChatRoomState | null
  viewer_display_name?: string | null
}>) {
  const { chat_state, render_state, loading, retry } =
    useChatRoomBootstrap(initial_chat_state)

  const room_uuid = chat_state?.room?.room_uuid ?? null
  const message_count = chat_state?.messages.length ?? 0
  const rendered_count = message_count

  useEffect(() => {
    console.info("[chat_bootstrap] user_chat_render_result", {
      room_uuid,
      rendered_count,
      loading,
      message_count,
      render_state,
    })

    if (room_uuid || message_count > 0 || !loading) {
      return
    }

    if (render_state !== "empty_error_recoverable") {
      return
    }

    send_chat_realtime_debug("user_chat_room_resolve_failed", {
      view: "user",
      reason: "client_timeout_missing_room_uuid",
      loading,
      message_count,
      rendered_count,
    })
  }, [loading, message_count, render_state, rendered_count, room_uuid])

  if (!chat_state) {
    return (
      <ChatLoadingState
        retry={render_state === "empty_error_recoverable" ? retry : null}
      />
    )
  }

  return (
    <ChatRoomPanel
      key={chat_state.room.room_uuid}
      initial_room={chat_state.room}
      initial_messages={chat_state.messages}
      initial_presence={chat_state.presence}
      participant_uuid={chat_state.participant.participant_uuid}
      viewer_display_name={viewer_display_name}
    />
  )
}
