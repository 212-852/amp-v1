"use client"

import ChatRoomPanel from "@/components/chat/room_panel"
import { useChatRoomBootstrap } from "@/components/chat/use_chat_room_bootstrap"
import type { ChatRoomState } from "@/core/chat/types"

export default function AppChatSection({
  chat_state: initial_chat_state,
  viewer_display_name = null,
}: Readonly<{
  chat_state: ChatRoomState | null
  viewer_display_name?: string | null
}>) {
  const chat_state = useChatRoomBootstrap(initial_chat_state)

  if (!chat_state) {
    return null
  }

  return (
    <ChatRoomPanel
      initial_room={chat_state.room}
      initial_messages={chat_state.messages}
      initial_presence={chat_state.presence}
      participant_uuid={chat_state.participant.participant_uuid}
      viewer_display_name={viewer_display_name}
    />
  )
}
