"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"

import type { ConciergeQueueItem } from "@/core/chat/concierge_queue"
import { concierge_queue_content } from "@/core/ops/concierge_queue_content"
import { TYPING_TIMEOUT_MS, type ChatTypingRecord } from "@/core/chat/types"
import { useLocale } from "@/src/components/locale/provider"
import { create_browser_supabase_client } from "@/src/lib/supabase/client"

function roomChannelName(room_uuid: string) {
  return `room:${room_uuid}`
}

function resolveInitials(value: string) {
  const normalized = value.trim()

  if (!normalized) {
    return "G"
  }

  const parts = normalized.split(/\s+/).filter(Boolean)

  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase()
  }

  return normalized.slice(0, 2).toUpperCase()
}

function useCustomerTyping(input: {
  room_uuid: string
  customer_participant_uuid: string
}) {
  const [is_typing, set_is_typing] = useState(false)
  const timer_ref = useRef<number | null>(null)

  useEffect(() => {
    function clear_timer() {
      if (timer_ref.current) {
        window.clearTimeout(timer_ref.current)
        timer_ref.current = null
      }
    }

    let supabase: ReturnType<typeof create_browser_supabase_client>

    try {
      supabase = create_browser_supabase_client()
    } catch {
      return
    }

    const channel = supabase.channel(roomChannelName(input.room_uuid), {
      config: {
        broadcast: {
          self: false,
        },
      },
    })

    channel
      .on("broadcast", { event: "typing_start" }, ({ payload }) => {
        const record = payload as ChatTypingRecord

        if (record?.participant_uuid !== input.customer_participant_uuid) {
          return
        }

        set_is_typing(true)
        clear_timer()
        timer_ref.current = window.setTimeout(() => {
          set_is_typing(false)
        }, TYPING_TIMEOUT_MS)
      })
      .on("broadcast", { event: "typing_stop" }, ({ payload }) => {
        const record = payload as ChatTypingRecord

        if (record?.participant_uuid !== input.customer_participant_uuid) {
          return
        }

        clear_timer()
        set_is_typing(false)
      })
      .subscribe()

    return () => {
      clear_timer()
      void supabase.removeChannel(channel)
    }
  }, [input.customer_participant_uuid, input.room_uuid])

  return is_typing
}

function ConciergeQueueCard({
  item,
}: Readonly<{
  item: ConciergeQueueItem
}>) {
  const { locale } = useLocale()
  const is_typing = useCustomerTyping({
    room_uuid: item.room_uuid,
    customer_participant_uuid: item.customer_participant_uuid,
  })

  return (
    <article className="flex items-start gap-3 rounded-2xl border border-neutral-200 bg-white px-3.5 py-3">
      <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full border border-neutral-200 bg-neutral-50">
        {item.customer_avatar_url ? (
          <img
            src={item.customer_avatar_url}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-[13px] font-semibold text-neutral-700">
            {resolveInitials(item.customer_name)}
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <p className="truncate text-[14px] font-semibold text-neutral-950">
            {item.customer_name}
          </p>
          <div className="shrink-0 text-right text-[11px] font-medium text-neutral-500">
            {is_typing ? (
              <span>{concierge_queue_content.typing[locale]}</span>
            ) : item.assigned_admin_name ? (
              <span>{item.assigned_admin_name}</span>
            ) : (
              <span className="text-[#dc2626]">
                {concierge_queue_content.unassigned[locale]}
              </span>
            )}
          </div>
        </div>
        <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-neutral-500">
          {item.latest_message_preview || "—"}
        </p>
      </div>
    </article>
  )
}

export default function ConciergeQueuePanel({
  items,
  show_footer = true,
}: Readonly<{
  items: ConciergeQueueItem[]
  show_footer?: boolean
}>) {
  const { locale } = useLocale()

  return (
    <section className="rounded-[28px] border border-neutral-200 bg-white px-5 py-4 shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
      <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-neutral-950">
        {concierge_queue_content.title[locale]}
      </h2>

      <div className="mt-4 flex flex-col gap-2.5">
        {items.length === 0 ? (
          <p className="text-[13px] text-neutral-500">
            {concierge_queue_content.empty[locale]}
          </p>
        ) : (
          items.map((item) => (
            <ConciergeQueueCard key={item.room_uuid} item={item} />
          ))
        )}
      </div>

      {show_footer ? (
        <div className="mt-4 flex justify-end">
          <Link
            href="/admin/concierge"
            className="text-[13px] font-semibold text-neutral-900"
          >
            {concierge_queue_content.view_all[locale]}
          </Link>
        </div>
      ) : null}
    </section>
  )
}
