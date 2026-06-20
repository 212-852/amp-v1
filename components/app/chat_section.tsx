"use client"

import ChatRoomPanel from "@/components/chat/room_panel"
import { useChatRoomBootstrap } from "@/components/chat/use_chat_room_bootstrap"
import type { ChatRoomState } from "@/core/chat/types"
import { useLocale } from "@/src/components/locale/provider"

const content = {
  loading: {
    ja: "チャットを読み込んでいます",
    en: "Loading chat",
    es: "Cargando chat",
  },
}

function ChatLoadingState() {
  const { locale } = useLocale()

  return (
    <section className="px-2 pt-2">
      <div className="inline-flex rounded-full bg-white/60 px-4 py-2 text-[13px] font-medium text-[#8c7358]">
        {content.loading[locale]}
      </div>
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
  const { chat_state } = useChatRoomBootstrap(initial_chat_state)

  if (!chat_state) {
    return <ChatLoadingState />
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
