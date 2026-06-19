"use client"

import { Send } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import type { Locale } from "@/src/lib/locale"

const content = {
  placeholder: {
    ja: "メッセージを入力",
    en: "Type a message",
    es: "Escribe un mensaje",
  },
}

type ChatMessageInputProps = {
  locale: Locale
  room_uuid?: string | null
  on_sent?: () => void
}

export default function ChatMessageInput({
  locale,
  room_uuid = null,
  on_sent,
}: Readonly<ChatMessageInputProps>) {
  const [value, set_value] = useState("")
  const [is_sending, set_is_sending] = useState(false)
  const typing_timer_ref = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (typing_timer_ref.current) {
        window.clearTimeout(typing_timer_ref.current)
      }
    }
  }, [])

  function send_typing(is_typing: boolean) {
    if (typing_timer_ref.current) {
      window.clearTimeout(typing_timer_ref.current)
      typing_timer_ref.current = null
    }

    void fetch("/api/chat/typing", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ is_typing, room_uuid }),
    }).catch(() => null)

    if (is_typing) {
      typing_timer_ref.current = window.setTimeout(() => {
        send_typing(false)
      }, 5000)
    }
  }

  async function send_message() {
    const message = value.trim()

    if (!message || is_sending) {
      return
    }

    set_is_sending(true)

    try {
      const response = await fetch("/api/chat/room", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message, locale, room_uuid }),
      })

      if (!response.ok) {
        return
      }

      set_value("")
      send_typing(false)
      window.dispatchEvent(new CustomEvent("amp-chat-message-created"))
      on_sent?.()
    } finally {
      set_is_sending(false)
    }
  }

  return (
    <form
      className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 bg-white px-4 py-3"
      onSubmit={(event) => {
        event.preventDefault()
        void send_message()
      }}
    >
      <div className="mx-auto flex w-full max-w-[430px] items-end gap-2">
        <textarea
          value={value}
          rows={1}
          placeholder={content.placeholder[locale]}
          onChange={(event) => {
            set_value(event.target.value)
            send_typing(Boolean(event.target.value.trim()))
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault()
              void send_message()
            }
          }}
          className="min-h-11 flex-1 resize-none rounded-md border border-neutral-300 bg-white px-3 py-2 text-[14px] leading-6 text-neutral-900 outline-none transition focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200"
        />
        <button
          type="submit"
          disabled={!value.trim() || is_sending}
          className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-neutral-900 text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:bg-neutral-300"
        >
          <Send aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
    </form>
  )
}
