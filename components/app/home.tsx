"use client"

import AppChatSection from "@/components/app/chat_section"
import type { ChatRoomState } from "@/core/chat/types"

export default function AppHome({
  chat_state,
  viewer_display_name = null,
}: Readonly<{
  chat_state: ChatRoomState | null
  viewer_display_name?: string | null
}>) {
  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-hidden px-4">
      <div className="chat_messages min-h-0 flex-1 overflow-y-auto overscroll-y-contain pt-4 pb-[calc(var(--chat-input-height,120px)+env(safe-area-inset-bottom,0px))]">
        <AppChatSection
          chat_state={chat_state}
          viewer_display_name={viewer_display_name}
        />
      </div>
    </main>
  )
}
