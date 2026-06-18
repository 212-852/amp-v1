"use client"

import { useMemo } from "react"

import ChatRoomPanel from "@/components/chat/room_panel"
import { useChatRoomBootstrap } from "@/components/chat/use_chat_room_bootstrap"
import { createBotMessageBundle } from "@/core/bot"
import type {
  ChatMessageRecord,
  ChatRoomState,
} from "@/core/chat/types"
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

function buildFallbackWelcome(locale: "ja" | "en" | "es"): ChatMessageRecord {
  const bundle = createBotMessageBundle({
    trigger: "chat_opened",
    locale,
  })

  console.info("[chat_bootstrap] chat_welcome_bundle_built", {
    locale,
    source: "client_fallback",
  })

  return {
    message_uuid: "fallback-welcome",
    room_uuid: "fallback-room",
    participant_uuid: null,
    message_kind: "welcome",
    type: bundle.type,
    status: "sent",
    body: bundle.body,
    payload: bundle.payload,
    source_channel: "web",
    external_id: null,
    created_at: new Date().toISOString(),
  }
}

function ChatWelcomeFallback({
  viewer_display_name,
}: Readonly<{
  viewer_display_name?: string | null
}>) {
  const { locale } = useLocale()
  const welcome = useMemo(() => buildFallbackWelcome(locale), [locale])

  return (
    <ChatRoomPanel
      initial_room={{
        room_uuid: "fallback-room",
        mode: "bot",
        locale,
        channel: "web",
        created_at: welcome.created_at,
        updated_at: welcome.created_at,
      }}
      initial_messages={[welcome]}
      initial_presence={[]}
      participant_uuid="fallback-participant"
      viewer_display_name={viewer_display_name}
    />
  )
}

export default function AppChatSection({
  chat_state: initial_chat_state,
  viewer_display_name = null,
}: Readonly<{
  chat_state: ChatRoomState | null
  viewer_display_name?: string | null
}>) {
  const { chat_state, render_state } = useChatRoomBootstrap(initial_chat_state)

  if (!chat_state) {
    if (render_state === "empty_error_recoverable") {
      return <ChatWelcomeFallback viewer_display_name={viewer_display_name} />
    }

    return <ChatLoadingState />
  }

  if (render_state === "ready_with_welcome" && chat_state.messages.length === 0) {
    return <ChatWelcomeFallback viewer_display_name={viewer_display_name} />
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
