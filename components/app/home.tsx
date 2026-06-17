"use client"

import AppChatSection from "@/components/app/chat_section"
import type { ChatRoomState } from "@/core/chat/types"

export default function AppHome({
  chat_state,
}: Readonly<{
  chat_state: ChatRoomState | null
}>) {
  return (
    <main className="mx-auto w-full max-w-[390px] px-4 pb-[calc(196px+env(safe-area-inset-bottom,0px))] pt-[118px]">
      <AppChatSection chat_state={chat_state} />
    </main>
  )
}
