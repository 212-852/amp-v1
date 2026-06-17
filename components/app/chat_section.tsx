"use client"

import ChatRoomPanel from "@/components/chat/room_panel"
import type { ChatRoomState } from "@/core/chat/types"

export default function AppChatSection({
  chat_state,
}: Readonly<{
  chat_state: ChatRoomState | null
}>) {
  if (!chat_state) {
    return null
  }

  return (
    <ChatRoomPanel
      initial_room={chat_state.room}
      initial_messages={chat_state.messages}
      initial_presence={chat_state.presence}
      participant_uuid={chat_state.participant.participant_uuid}
    />
  )
}
