"use client"

import { useEffect, useRef, useState } from "react"

import { TYPING_TIMEOUT_MS, type ChatTypingRecord } from "@/core/chat/types"
import { create_browser_supabase_client } from "@/src/lib/supabase/client"

import { roomChannelName } from "@/core/chat/room_channel"

export function useRoomTyping(input: {
  room_uuid: string
  participant_uuid: string
}) {
  const [typing, set_typing] = useState<ChatTypingRecord[]>([])
  const timers_ref = useRef<Map<string, number>>(new Map())

  useEffect(() => {
    const timers = timers_ref.current

    function clear_timer(participant_uuid: string) {
      const timer = timers.get(participant_uuid)

      if (timer) {
        window.clearTimeout(timer)
        timers.delete(participant_uuid)
      }
    }

    function remove_typing(participant_uuid: string) {
      clear_timer(participant_uuid)
      set_typing((current) =>
        current.filter((entry) => entry.participant_uuid !== participant_uuid),
      )
    }

    function schedule_stop(participant_uuid: string) {
      clear_timer(participant_uuid)
      timers.set(
        participant_uuid,
        window.setTimeout(() => {
          remove_typing(participant_uuid)
        }, TYPING_TIMEOUT_MS),
      )
    }

    function add_typing(entry: ChatTypingRecord) {
      if (entry.participant_uuid === input.participant_uuid) {
        return
      }

      set_typing((current) => {
        const others = current.filter(
          (item) => item.participant_uuid !== entry.participant_uuid,
        )
        return [...others, entry]
      })
      schedule_stop(entry.participant_uuid)
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

        if (!record?.participant_uuid || !record.room_uuid) {
          return
        }

        add_typing({
          room_uuid: record.room_uuid,
          participant_uuid: record.participant_uuid,
          display_name: record.display_name ?? "Guest",
          locale: record.locale ?? "ja",
        })
      })
      .on("broadcast", { event: "typing_stop" }, ({ payload }) => {
        const record = payload as ChatTypingRecord

        if (!record?.participant_uuid) {
          return
        }

        remove_typing(record.participant_uuid)
      })
      .subscribe()

    return () => {
      for (const timer of timers.values()) {
        window.clearTimeout(timer)
      }

      timers.clear()
      void supabase.removeChannel(channel)
    }
  }, [input.participant_uuid, input.room_uuid])

  return typing
}
