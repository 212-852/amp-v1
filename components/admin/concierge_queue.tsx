"use client"

import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"

import type { ConciergeQueueItem } from "@/core/chat/concierge_queue"
import type { ConciergeQueueResult } from "@/core/concierge/action"
import { room_matches_concierge_queue_condition } from "@/core/concierge/rules"
import { concierge_queue_content } from "@/core/ops/concierge_queue_content"
import { TYPING_TIMEOUT_MS, type ChatTypingRecord } from "@/core/chat/types"
import { useLocale } from "@/src/components/locale/provider"
import { create_browser_supabase_client } from "@/src/lib/supabase/client"

type QueueMode = "concierge" | "bot"

export const ADMIN_QUEUE_REFRESH_EVENT = "amp-admin-queue-refresh"

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

  return input.enabled ? is_typing : false
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
  const row_background = (index + 1) % 2 === 0 ? "bg-neutral-50" : "bg-white"

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
        {item.admin_active_count > 0 ? (
          <span
            aria-hidden="true"
            className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-neutral-900"
          />
        ) : null}
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

async function fetchConciergeQueueFromApi(
  mode: QueueMode,
  strict_concierge: boolean,
): Promise<ConciergeQueueResult | null> {
  const params = new URLSearchParams({
    list: "1",
    mode,
  })

  if (strict_concierge) {
    params.set("strict", "1")
  }
  const response = await fetch(`/api/chat/concierge?${params.toString()}`, {
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
    room_condition: payload.room_condition ?? { mode },
    rooms: payload.rooms ?? payload.items ?? [],
    items: payload.items ?? payload.rooms ?? [],
  }
}

export default function AdminConciergeQueue({
  queue,
  variant = "tabs",
  seeded_from_server = false,
  availability_enabled,
}: Readonly<{
  queue?: ConciergeQueueResult
  variant?: "preview" | "tabs"
  seeded_from_server?: boolean
  availability_enabled?: boolean
}>) {
  const { locale } = useLocale()
  const resolved_availability =
    availability_enabled ?? queue?.availability_enabled === true
  const [is_available, set_is_available] = useState(resolved_availability)
  const [active_tab, set_active_tab] = useState<QueueMode>(
    queue?.room_condition?.mode === "bot" ? "bot" : "concierge",
  )
  const [items, set_items] = useState<ConciergeQueueItem[]>(
    queue?.should_show_list
      ? (queue.rooms ?? queue.items ?? []).slice(
          0,
          variant === "preview" ? 5 : undefined,
        )
      : [],
  )
  const [is_loading, set_is_loading] = useState(false)
  const refresh_request_ref = useRef(0)

  const load_queue = useCallback(async (options?: {
    silent?: boolean
    mode?: QueueMode
  }) => {
    const mode = options?.mode ?? active_tab
    const request_id = refresh_request_ref.current + 1
    refresh_request_ref.current = request_id

    if (!options?.silent) {
      set_is_loading(true)
    }

    try {
      const result = await fetchConciergeQueueFromApi(
        mode,
        variant === "preview",
      )

      if (refresh_request_ref.current !== request_id) {
        return
      }

      if (!result) {
        return
      }

      if (!result.should_show_list) {
        if (result.availability_enabled === false) {
          set_is_available(false)
        }
        set_items([])
        return
      }

      set_is_available(result.availability_enabled === true)
      set_items(
        (result.rooms ?? result.items ?? []).slice(
          0,
          variant === "preview" ? 5 : undefined,
        ),
      )
    } finally {
      if (refresh_request_ref.current === request_id) {
        set_is_loading(false)
      }
    }
  }, [active_tab, variant])

  function change_tab(mode: QueueMode) {
    if (mode === active_tab) {
      return
    }

    set_active_tab(mode)
    set_items([])
    void load_queue({ mode })
  }

  useEffect(() => {
    if (typeof availability_enabled === "boolean") {
      const timer = window.setTimeout(() => {
        set_is_available(availability_enabled)

        if (!availability_enabled) {
          refresh_request_ref.current += 1
          set_items([])
          set_is_loading(false)
        }
      }, 0)

      return () => {
        window.clearTimeout(timer)
      }
    }

    return undefined
  }, [availability_enabled])

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

      void load_queue({ mode: active_tab })
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
  }, [active_tab, load_queue])

  useEffect(() => {
    if (!is_available) {
      return
    }

    function handle_queue_refresh() {
      void load_queue({ silent: true })
    }

    window.addEventListener(ADMIN_QUEUE_REFRESH_EVENT, handle_queue_refresh)
    window.addEventListener("amp-chat-message-created", handle_queue_refresh)

    return () => {
      window.removeEventListener(ADMIN_QUEUE_REFRESH_EVENT, handle_queue_refresh)
      window.removeEventListener("amp-chat-message-created", handle_queue_refresh)
    }
  }, [is_available, load_queue])

  useEffect(() => {
    if (!is_available) {
      const timer = window.setTimeout(() => {
        refresh_request_ref.current += 1
        set_items([])
        set_is_loading(false)
      }, 0)

      return () => {
        window.clearTimeout(timer)
      }
    }

    let cancelled = false
    let debounce_timer: number | null = null
    let initial_timer: number | null = null

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

    function handle_message_insert() {
      if (!cancelled) {
        void load_queue({ silent: true })
      }
    }

    const has_initial_items =
      (queue?.should_show_list ? (queue.rooms ?? queue.items ?? []).length : 0) >
      0

    const skip_initial_fetch = seeded_from_server

    if (!skip_initial_fetch) {
      initial_timer = window.setTimeout(() => {
        if (!cancelled) {
          void load_queue({ silent: has_initial_items })
        }
      }, 0)
    }

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
            thread_status?: string | null
          } | null
          const new_record = payload.new as {
            room_uuid?: string
            mode?: string
            thread_status?: string | null
          } | null
          const room_uuid = new_record?.room_uuid ?? old_record?.room_uuid
          const matches_active_tab =
            new_record &&
            room_matches_concierge_queue_condition(new_record, {
              mode: active_tab,
              strict_concierge: variant === "preview",
            })

          if (!matches_active_tab && room_uuid) {
            set_items((current) =>
              current.filter((item) => item.room_uuid !== room_uuid),
            )
            return
          }

          if (matches_active_tab) {
            schedule_refresh()
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        handle_message_insert,
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages" },
        schedule_refresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "presence" },
        schedule_refresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "users" },
        schedule_refresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
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

            void load_queue({ mode: active_tab })
          }
        },
      )
      .subscribe()

    return () => {
      cancelled = true

      if (debounce_timer) {
        window.clearTimeout(debounce_timer)
      }

      if (initial_timer) {
        window.clearTimeout(initial_timer)
      }

      void supabase.removeChannel(channel)
    }
  }, [
    active_tab,
    is_available,
    load_queue,
    queue?.items,
    queue?.rooms,
    queue?.should_show_list,
    seeded_from_server,
    variant,
  ])

  if (!is_available) {
    return null
  }

  return (
    <section
      className={
        variant === "preview"
          ? ""
          : "relative pb-9"
      }
    >
      {variant === "preview" ? (
        <div className="mb-2 px-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-baseline gap-2">
              <h2 className="shrink-0 text-[13px] font-semibold text-neutral-600">
                {concierge_queue_content.pending_title[locale]}
              </h2>
              <p className="truncate text-[12px] font-medium text-neutral-400">
                {concierge_queue_content.waiting[locale]} {items.length}
              </p>
            </div>
            <Link
              href="/admin/list"
              className="text-[12px] font-semibold text-neutral-500 transition hover:text-neutral-800 active:text-neutral-700"
            >
              {concierge_queue_content.view_all[locale]}
            </Link>
          </div>
        </div>
      ) : (
        <div className="mb-2 grid grid-cols-2 border-b border-neutral-200 text-[13px] font-semibold">
          {(["concierge", "bot"] as const).map((mode) => {
            const active = active_tab === mode
            const label =
              mode === "concierge"
                ? concierge_queue_content.concierge_tab[locale]
                : concierge_queue_content.bot_tab[locale]

            return (
              <button
                key={mode}
                type="button"
                aria-pressed={active}
                onClick={() => change_tab(mode)}
                className={[
                  "border-b-2 px-3 py-2 text-center transition",
                  active
                    ? "border-neutral-950 text-neutral-950"
                    : "border-transparent text-neutral-500 hover:text-neutral-800",
                ].join(" ")}
              >
                {label}
              </button>
            )
          })}
        </div>
      )}

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
    </section>
  )
}
