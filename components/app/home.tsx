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
      <div className="min-h-0 flex-1 flex flex-col overflow-hidden pt-4">
        <AppChatSection
          chat_state={chat_state}
          viewer_display_name={viewer_display_name}
        />
      </div>
    </main>
  )
}
