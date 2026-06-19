"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"

import type { ConciergeQueueItem } from "@/core/chat/concierge_queue"
import type { ConciergeQueueResult } from "@/core/concierge/action"
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
    <article className="flex items-center gap-3 border-b border-neutral-200 py-3 last:border-b-0">
      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-neutral-100">
        {item.avatar_url ? (
          <img
            src={item.avatar_url}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-[13px] font-semibold text-neutral-700">
            {resolveInitials(item.display_name)}
          </span>
        )}
        {item.admin_active_count > 0 ? (
          <span className="absolute bottom-0 right-0 flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-white bg-[#16a34a] px-1 text-[9px] font-bold leading-none text-white">
            {item.admin_active_count > 1 ? item.admin_active_count : ""}
          </span>
        ) : null}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <p className="truncate text-[14px] font-semibold text-neutral-950">
            {item.display_name}
          </p>
          <div className="shrink-0 text-right text-[11px] font-medium text-[#16a34a]">
            {is_typing ? (
              <span>{concierge_queue_content.typing[locale]}</span>
            ) : null}
          </div>
        </div>
        <p className="mt-1 truncate text-[13px] leading-snug text-neutral-500">
          {is_typing
            ? concierge_queue_content.typing[locale]
            : item.latest_message || "—"}
        </p>
      </div>
    </article>
  )
}

export default function ConciergeQueuePanel({
  items,
  queue,
  show_footer = true,
}: Readonly<{
  items?: ConciergeQueueItem[]
  queue?: ConciergeQueueResult
  show_footer?: boolean
}>) {
  const { locale } = useLocale()
  const router = useRouter()
  const should_show_list = queue?.should_show_list ?? true
  const rendered_items = queue?.rooms ?? queue?.items ?? items ?? []

  useEffect(() => {
    if (!should_show_list) {
      return
    }

    let supabase: ReturnType<typeof create_browser_supabase_client>

    try {
      supabase = create_browser_supabase_client()
    } catch {
      return
    }

    const channel = supabase
      .channel("admin:concierge_queue")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rooms" },
        () => router.refresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        () => router.refresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "presence" },
        () => router.refresh(),
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [router, should_show_list])

  if (!should_show_list) {
    return null
  }

  return (
    <section>
      <div className="flex flex-col">
        {rendered_items.length === 0 ? (
          <p className="text-[13px] text-neutral-500">
            {concierge_queue_content.empty[locale]}
          </p>
        ) : (
          rendered_items.map((item) => (
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
