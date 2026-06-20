"use client"

import type { Locale } from "@/src/lib/locale"

export function create_client_message_id() {
  return `client:${crypto.randomUUID()}`
}

export function dispatch_optimistic_message(input: {
  room_uuid?: string | null
  participant_uuid?: string | null
  body: string
  client_message_id: string
}) {
  window.dispatchEvent(
    new CustomEvent("amp-chat-optimistic-message", {
      detail: input,
    }),
  )
  window.dispatchEvent(
    new CustomEvent("amp-chat-scroll-bottom", {
      detail: { reason: "own_send", force: true },
    }),
  )
}

export function dispatch_message_failed(client_message_id: string) {
  window.dispatchEvent(
    new CustomEvent("amp-chat-message-failed", {
      detail: { client_message_id },
    }),
  )
}

export async function send_chat_message(input: {
  message: string
  locale: Locale
  room_uuid?: string | null
  client_message_id: string
}) {
  const response = await fetch("/api/chat/room", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: input.message,
      locale: input.locale,
      room_uuid: input.room_uuid,
      client_message_id: input.client_message_id,
    }),
  })

  const payload = (await response.json().catch(() => null)) as {
    message?: unknown
  } | null

  return {
    ok: response.ok,
    payload,
  }
}

export function dispatch_message_archived(input: {
  room_uuid?: string | null
  message: unknown
}) {
  window.dispatchEvent(
    new CustomEvent("amp-chat-message-archived", {
      detail: input,
    }),
  )
}

export function dispatch_message_created() {
  window.dispatchEvent(new CustomEvent("amp-chat-message-created"))
}
