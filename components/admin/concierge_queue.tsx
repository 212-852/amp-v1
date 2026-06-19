"use client"

import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"

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
  enabled: boolean
  room_uuid: string
  customer_participant_uuid: string
}) {
  const [is_typing, set_is_typing] = useState(false)
  const timer_ref = useRef<number | null>(null)

  useEffect(() => {
    if (!input.enabled) {
      set_is_typing(false)
      return
    }

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
  }, [input.customer_participant_uuid, input.enabled, input.room_uuid])

  return is_typing
}

function ConciergeQueueCard({
  index,
  item,
  list_enabled,
}: Readonly<{
  index: number
  item: ConciergeQueueItem
  list_enabled: boolean
}>) {
  const { locale } = useLocale()
  const is_typing = useCustomerTyping({
    enabled: list_enabled,
    room_uuid: item.room_uuid,
    customer_participant_uuid: item.customer_participant_uuid,
  })
  const row_background = index % 2 === 0 ? "bg-neutral-50" : "bg-white"

  return (
    <Link
      href={item.href}
      className={[
        "flex items-center gap-3 border-b border-neutral-200 px-2 py-3 transition",
        "hover:bg-neutral-100 active:bg-neutral-200",
        "last:border-b-0",
        row_background,
      ].join(" ")}
    >
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
        <span
          aria-hidden="true"
          className={[
            "absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white",
            item.admin_active_count > 0 ? "bg-neutral-900" : "bg-neutral-300",
          ].join(" ")}
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <p className="truncate text-[14px] font-semibold text-neutral-950">
            {item.display_name}
          </p>
          {is_typing ? (
            <span className="shrink-0 text-[11px] font-medium text-neutral-500">
              {concierge_queue_content.typing[locale]}
            </span>
          ) : null}
        </div>
        <p className="mt-1 truncate text-[13px] leading-snug text-neutral-500">
          {is_typing
            ? concierge_queue_content.typing[locale]
            : item.latest_message || "—"}
        </p>
      </div>
    </Link>
  )
}

async function fetchConciergeQueueFromApi(): Promise<ConciergeQueueResult | null> {
  const response = await fetch("/api/chat/concierge?list=1", {
    cache: "no-store",
  })

  if (!response.ok) {
    return null
  }

  const payload = (await response.json()) as ConciergeQueueResult & {
    ok?: boolean
    enabled?: boolean
  }

  if (payload.ok === false) {
    return null
  }

  return {
    availability_enabled: payload.availability_enabled ?? payload.enabled === true,
    should_show_list: payload.should_show_list ?? false,
    room_condition: payload.room_condition ?? { mode: "concierge" },
    rooms: payload.rooms ?? payload.items ?? [],
    items: payload.items ?? payload.rooms ?? [],
  }
}

export default function AdminConciergeQueue({
  queue,
  show_footer = true,
}: Readonly<{
  queue?: ConciergeQueueResult
  show_footer?: boolean
}>) {
  const { locale } = useLocale()
  const [is_available, set_is_available] = useState(
    queue?.availability_enabled === true,
  )
  const [items, set_items] = useState<ConciergeQueueItem[]>(
    queue?.should_show_list ? (queue.rooms ?? queue.items ?? []) : [],
  )
  const [is_loading, set_is_loading] = useState(false)
  const refresh_request_ref = useRef(0)

  const load_queue = useCallback(async (options?: { silent?: boolean }) => {
    const request_id = refresh_request_ref.current + 1
    refresh_request_ref.current = request_id

    if (!options?.silent) {
      set_is_loading(true)
    }

    try {
      const result = await fetchConciergeQueueFromApi()

      if (refresh_request_ref.current !== request_id) {
        return
      }

      if (!result?.should_show_list) {
        set_is_available(false)
        set_items([])
        return
      }

      set_is_available(true)
      set_items(result.rooms ?? result.items ?? [])
    } finally {
      if (refresh_request_ref.current === request_id) {
        set_is_loading(false)
      }
    }
  }, [])

  useEffect(() => {
    function handle_availability_change(event: Event) {
      const detail = (event as CustomEvent<{ enabled?: boolean }>).detail

      if (typeof detail?.enabled !== "boolean") {
        return
      }

      set_is_available(detail.enabled)

      if (!detail.enabled) {
        refresh_request_ref.current += 1
        set_items([])
        set_is_loading(false)
        return
      }

      void load_queue()
    }

    window.addEventListener(
      "amp-concierge-availability-changed",
      handle_availability_change,
    )

    return () => {
      window.removeEventListener(
        "amp-concierge-availability-changed",
        handle_availability_change,
      )
    }
  }, [load_queue])

  useEffect(() => {
    if (!is_available) {
      set_items([])
      return
    }

    let cancelled = false
    let debounce_timer: number | null = null

    function schedule_refresh() {
      if (debounce_timer) {
        window.clearTimeout(debounce_timer)
      }

      debounce_timer = window.setTimeout(() => {
        if (!cancelled) {
          void load_queue({ silent: true })
        }
      }, 150)
    }

    const has_initial_items =
      (queue?.should_show_list ? (queue.rooms ?? queue.items ?? []).length : 0) >
      0

    void load_queue({ silent: has_initial_items })

    let supabase: ReturnType<typeof create_browser_supabase_client>

    try {
      supabase = create_browser_supabase_client()
    } catch {
      return () => {
        cancelled = true
        if (debounce_timer) {
          window.clearTimeout(debounce_timer)
        }
      }
    }

    const channel = supabase
      .channel("admin:concierge_queue")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rooms" },
        (payload) => {
          const old_record = payload.old as {
            room_uuid?: string
            mode?: string
          } | null
          const new_record = payload.new as {
            room_uuid?: string
            mode?: string
          } | null
          const room_uuid = new_record?.room_uuid ?? old_record?.room_uuid

          if (
            old_record?.mode === "concierge" &&
            new_record?.mode !== "concierge" &&
            room_uuid
          ) {
            set_items((current) =>
              current.filter((item) => item.room_uuid !== room_uuid),
            )
            return
          }

          if (new_record?.mode === "concierge") {
            schedule_refresh()
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        schedule_refresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "presence" },
        schedule_refresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "availability" },
        (payload) => {
          const next_enabled = (payload.new as { enabled?: unknown })?.enabled

          if (typeof next_enabled === "boolean") {
            set_is_available(next_enabled)

            if (!next_enabled) {
              refresh_request_ref.current += 1
              set_items([])
              set_is_loading(false)
              return
            }

            void load_queue()
          }
        },
      )
      .subscribe()

    return () => {
      cancelled = true

      if (debounce_timer) {
        window.clearTimeout(debounce_timer)
      }

      void supabase.removeChannel(channel)
    }
  }, [is_available, load_queue, queue?.items, queue?.rooms, queue?.should_show_list])

  if (!is_available) {
    return null
  }

  return (
    <section>
      {is_loading && items.length === 0 ? (
        <div className="px-2 pt-2">
          <div className="inline-flex rounded-full bg-white/60 px-4 py-2 text-[13px] font-medium text-neutral-500">
            {concierge_queue_content.loading[locale]}
          </div>
        </div>
      ) : null}

      <div className="flex flex-col">
        {items.length === 0 && !is_loading ? (
          <p className="px-2 py-2 text-[13px] text-neutral-500">
            {concierge_queue_content.empty[locale]}
          </p>
        ) : (
          items.map((item, index) => (
            <ConciergeQueueCard
              key={item.room_uuid}
              index={index}
              item={item}
              list_enabled={is_available}
            />
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
