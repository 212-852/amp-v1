"use client"

import { useEffect, useRef, useState } from "react"

import type { ChatRoomState } from "@/core/chat/types"
import { useLocale } from "@/src/components/locale/provider"
import type { Locale } from "@/src/lib/locale"

type ChatRoomApiPayload = {
  room: ChatRoomState["room"] | null
  participant: ChatRoomState["participant"] | null
  messages: ChatRoomState["messages"]
  presence: ChatRoomState["presence"]
  concierge_available: boolean
}

let bootstrap_promise: Promise<ChatRoomState | null> | null = null
let bootstrap_promise_locale: Locale | null = null
const CHAT_BOOTSTRAP_TIMEOUT_MS = 3000
const CHAT_BOOTSTRAP_RETRY_MS = 5000

export type ChatRoomBootstrapViewState = {
  chat_state: ChatRoomState | null
  timed_out: boolean
  render_state:
    | "loading"
    | "ready_with_messages"
    | "ready_with_welcome"
    | "empty_error_recoverable"
}

function logClientBootstrap(
  event: string,
  data: Record<string, unknown> = {},
) {
  console.info(`[chat_bootstrap] ${event}`, data)
}

async function bootstrapChatRoomRequest(locale: Locale): Promise<ChatRoomState | null> {
  logClientBootstrap("chat_bootstrap_started", { locale })
  logClientBootstrap("message initial fetch start", { locale })
  const response = await fetch("/api/chat/room", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ trigger: "chat_opened", locale }),
  })

  if (!response.ok) {
    const error_message = await response.text().catch(() => "")
    logClientBootstrap("chat_bootstrap_completed", {
      locale,
      ok: false,
      status: response.status,
    })
    logClientBootstrap("message initial fetch error", {
      locale,
      status: response.status,
      error_message,
    })
    return null
  }

  const payload = (await response.json()) as ChatRoomApiPayload

  if (!payload.room || !payload.participant) {
    logClientBootstrap("chat_bootstrap_completed", {
      locale,
      ok: true,
      has_room: Boolean(payload.room),
      has_participant: Boolean(payload.participant),
      message_count: payload.messages?.length ?? 0,
    })
    logClientBootstrap("message initial fetch error", {
      locale,
      reason: "missing_room_or_participant",
      has_room: Boolean(payload.room),
      has_participant: Boolean(payload.participant),
    })
    return null
  }

  logClientBootstrap("user room_uuid resolved", {
    room_uuid: payload.room.room_uuid,
  })
  logClientBootstrap("message initial fetch success count", {
    locale,
    room_uuid: payload.room.room_uuid,
    message_count: payload.messages?.length ?? 0,
  })
  logClientBootstrap("chat_bootstrap_completed", {
    locale,
    ok: true,
    has_room: true,
    has_participant: true,
    message_count: payload.messages?.length ?? 0,
  })

  return {
    room: payload.room,
    participant: payload.participant,
    messages: payload.messages,
    presence: payload.presence,
    concierge_available: payload.concierge_available,
  }
}

async function loadOrBootstrapChatRoom(locale: Locale): Promise<ChatRoomState | null> {
  return bootstrapChatRoomRequest(locale).catch(() => null)
}

export function useChatRoomBootstrap(
  initial_state: ChatRoomState | null,
): ChatRoomBootstrapViewState {
  const { locale } = useLocale()
  const [chat_state, set_chat_state] = useState<ChatRoomState | null>(
    initial_state,
  )
  const [timed_out, set_timed_out] = useState(false)
  const [retry_tick, set_retry_tick] = useState(0)
  const bootstrapping_ref = useRef(false)

  useEffect(() => {
    let cancelled = false
    let timeout_timer: number | null = window.setTimeout(() => {
      if (!cancelled) {
        set_timed_out(true)
      }
    }, CHAT_BOOTSTRAP_TIMEOUT_MS)
    let retry_timer: number | null = null

    function clearTimeoutTimer() {
      if (timeout_timer) {
        window.clearTimeout(timeout_timer)
        timeout_timer = null
      }
    }

    async function ensureChatRoom() {
      if (bootstrapping_ref.current) {
        logClientBootstrap("chat_bootstrap_skipped_already_running")
        return
      }

      if (bootstrap_promise && bootstrap_promise_locale === locale) {
        logClientBootstrap("chat_bootstrap_skipped_already_running")
      } else {
        bootstrap_promise_locale = locale
        bootstrap_promise = loadOrBootstrapChatRoom(locale)
      }

      bootstrapping_ref.current = true

      try {
        const state = await bootstrap_promise

        if (!cancelled && state) {
          set_chat_state(state)
          set_timed_out(false)
          clearTimeoutTimer()
        } else if (!cancelled) {
          set_timed_out(true)
          retry_timer = window.setTimeout(() => {
            bootstrap_promise = null
            set_retry_tick((current) => current + 1)
          }, CHAT_BOOTSTRAP_RETRY_MS)
        }
      } finally {
        bootstrapping_ref.current = false
      }
    }

    void ensureChatRoom()

    return () => {
      cancelled = true
      clearTimeoutTimer()
      if (retry_timer) {
        window.clearTimeout(retry_timer)
      }
    }
  }, [locale, retry_tick])

  const render_state = chat_state
    ? chat_state.messages.length > 0
      ? "ready_with_messages"
      : "ready_with_welcome"
    : timed_out
      ? "empty_error_recoverable"
      : "loading"

  useEffect(() => {
    logClientBootstrap("chat_render_state_resolved", {
      locale,
      render_state,
      message_count: chat_state?.messages.length ?? 0,
      has_room: Boolean(chat_state?.room),
    })
  }, [chat_state?.messages.length, chat_state?.room, locale, render_state])

  return { chat_state, timed_out, render_state }
}
