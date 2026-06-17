"use client"

import { useEffect, useRef, useState } from "react"

import type { ChatRoomState } from "@/core/chat/types"

type ChatRoomApiPayload = {
  room: ChatRoomState["room"] | null
  participant: ChatRoomState["participant"] | null
  messages: ChatRoomState["messages"]
  presence: ChatRoomState["presence"]
  concierge_available: boolean
}

let bootstrap_promise: Promise<ChatRoomState | null> | null = null

function logClientBootstrap(
  event: string,
  data: Record<string, unknown> = {},
) {
  console.info(`[chat_bootstrap] ${event}`, data)
}

async function getChatRoom(): Promise<ChatRoomApiPayload | null> {
  const response = await fetch("/api/chat/room", { cache: "no-store" })

  if (!response.ok) {
    return null
  }

  return (await response.json()) as ChatRoomApiPayload
}

async function bootstrapChatRoomRequest(): Promise<ChatRoomState | null> {
  const response = await fetch("/api/chat/room", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ trigger: "chat_opened" }),
  })

  if (!response.ok) {
    return null
  }

  const payload = (await response.json()) as ChatRoomApiPayload

  if (!payload.room || !payload.participant) {
    return null
  }

  return {
    room: payload.room,
    participant: payload.participant,
    messages: payload.messages,
    presence: payload.presence,
    concierge_available: payload.concierge_available,
  }
}

function toChatRoomState(payload: ChatRoomApiPayload): ChatRoomState | null {
  if (!payload.room || !payload.participant) {
    return null
  }

  return {
    room: payload.room,
    participant: payload.participant,
    messages: payload.messages,
    presence: payload.presence,
    concierge_available: payload.concierge_available,
  }
}

async function loadOrBootstrapChatRoom(): Promise<ChatRoomState | null> {
  const existing = await getChatRoom()
  const existing_state = existing ? toChatRoomState(existing) : null

  if (existing_state) {
    return existing_state
  }

  return bootstrapChatRoomRequest()
}

export function useChatRoomBootstrap(
  initial_state: ChatRoomState | null,
): ChatRoomState | null {
  const [chat_state, set_chat_state] = useState<ChatRoomState | null>(
    initial_state,
  )
  const bootstrapping_ref = useRef(false)

  useEffect(() => {
    let cancelled = false

    async function ensureChatRoom() {
      if (bootstrapping_ref.current) {
        logClientBootstrap("chat_bootstrap_skipped_already_running")
        return
      }

      if (bootstrap_promise) {
        logClientBootstrap("chat_bootstrap_skipped_already_running")
      } else {
        bootstrap_promise = loadOrBootstrapChatRoom()
      }

      bootstrapping_ref.current = true

      try {
        const state = await bootstrap_promise

        if (!cancelled && state) {
          set_chat_state(state)
        }
      } finally {
        bootstrapping_ref.current = false
      }
    }

    void ensureChatRoom()

    return () => {
      cancelled = true
    }
  }, [])

  return chat_state
}
