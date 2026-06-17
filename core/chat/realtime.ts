import { create_service_role_supabase_client } from "@/core/auth/supabase"
import type { ChatLocale, RealtimeTypingEvent } from "@/core/chat/types"

export type TypingBroadcastInput = {
  room_uuid: string
  participant_uuid: string
  display_name: string
  locale: ChatLocale
  event: RealtimeTypingEvent
}

function roomChannelName(room_uuid: string) {
  return `room:${room_uuid}`
}

export async function broadcastTypingEvent(input: TypingBroadcastInput) {
  const supabase = create_service_role_supabase_client()
  const channel = supabase.channel(roomChannelName(input.room_uuid), {
    config: {
      broadcast: {
        ack: false,
        self: false,
      },
    },
  })

  return new Promise<{ delivered: boolean }>((resolve) => {
    const timeout = setTimeout(() => {
      void supabase.removeChannel(channel)
      resolve({ delivered: false })
    }, 3000)

    channel.subscribe((status) => {
      if (status !== "SUBSCRIBED") {
        return
      }

      void channel
        .send({
          type: "broadcast",
          event: input.event,
          payload: {
            room_uuid: input.room_uuid,
            participant_uuid: input.participant_uuid,
            display_name: input.display_name,
            locale: input.locale,
          },
        })
        .then(() => {
          clearTimeout(timeout)
          void supabase.removeChannel(channel)
          resolve({ delivered: true })
        })
        .catch(() => {
          clearTimeout(timeout)
          void supabase.removeChannel(channel)
          resolve({ delivered: false })
        })
    })
  })
}

export function resolveTypingEvent(is_typing: boolean): RealtimeTypingEvent {
  return is_typing ? "typing_start" : "typing_stop"
}
