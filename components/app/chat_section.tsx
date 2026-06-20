"use client"

import { useMemo } from "react"

import ChatRoomPanel from "@/components/chat/room_panel"
import { useChatRoomBootstrap } from "@/components/chat/use_chat_room_bootstrap"
import { createBotMessageBundle } from "@/core/bot"
import type { SourceChannel } from "@/core/auth/types"
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

const FALLBACK_CREATED_AT = "1970-01-01T00:00:00.000Z"

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

function buildFallbackWelcome({
  locale,
  room_uuid,
  source_channel = "web",
}: {
  locale: "ja" | "en" | "es"
  room_uuid: string
  source_channel?: SourceChannel | null
}): ChatMessageRecord {
  const bundle = createBotMessageBundle({
    trigger: "chat_opened",
    locale,
  })

  console.info("[chat_bootstrap] chat_welcome_bundle_built", {
    locale,
    source: "client_fallback",
  })

  return {
    message_uuid: `fallback-welcome-${room_uuid}`,
    room_uuid,
    participant_uuid: null,
    message_kind: "welcome",
    type: bundle.type,
    status: "sent",
    body: bundle.body,
    payload: bundle.payload,
    source_channel: source_channel ?? "web",
    external_id: null,
    created_at: FALLBACK_CREATED_AT,
  }
}

function resolveInitialMessages(
  chat_state: ChatRoomState,
  locale: "ja" | "en" | "es",
): ChatMessageRecord[] {
  if (chat_state.messages.length > 0) {
    return chat_state.messages
  }

  return [
    buildFallbackWelcome({
      locale,
      room_uuid: chat_state.room.room_uuid,
      source_channel: chat_state.room.channel,
    }),
  ]
}

export default function AppChatSection({
  chat_state: initial_chat_state,
  viewer_display_name = null,
}: Readonly<{
  chat_state: ChatRoomState | null
  viewer_display_name?: string | null
}>) {
  const { locale } = useLocale()
  const { chat_state } = useChatRoomBootstrap(initial_chat_state)

  const initial_messages = useMemo(
    () => (chat_state ? resolveInitialMessages(chat_state, locale) : []),
    [chat_state, locale],
  )

  if (!chat_state) {
    return <ChatLoadingState />
  }

  return (
    <ChatRoomPanel
      key={chat_state.room.room_uuid}
      initial_room={chat_state.room}
      initial_messages={initial_messages}
      initial_presence={chat_state.presence}
      participant_uuid={chat_state.participant.participant_uuid}
      viewer_display_name={viewer_display_name}
    />
  )
}
