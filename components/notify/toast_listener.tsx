"use client"

import { useEffect } from "react"

import { useToast } from "@/components/ui/use_toast"
import { CHAT_IN_APP_TOAST_MESSAGE } from "@/core/notify/messages"
import { create_browser_supabase_client } from "@/src/lib/supabase/client"

function notifyUserChannelName(user_uuid: string) {
  return `notify:${user_uuid}`
}

type SessionResponse = {
  user_uuid?: string | null
}

export function NotifyToastListener() {
  const { toast } = useToast()

  useEffect(() => {
    let active = true
    let channel: ReturnType<
      ReturnType<typeof create_browser_supabase_client>["channel"]
    > | null = null
    const supabase = create_browser_supabase_client()

    async function subscribe() {
      const response = await fetch("/api/auth/session", {
        cache: "no-store",
      }).catch(() => null)

      if (!response?.ok || !active) {
        return
      }

      const session = (await response.json()) as SessionResponse
      const user_uuid = session.user_uuid?.trim()

      if (!user_uuid || !active) {
        return
      }

      channel = supabase.channel(notifyUserChannelName(user_uuid), {
        config: {
          broadcast: {
            ack: false,
            self: false,
          },
        },
      })

      channel
        .on("broadcast", { event: "notify_toast" }, ({ payload }) => {
          const message =
            typeof payload?.message === "string" && payload.message.trim()
              ? payload.message.trim()
              : CHAT_IN_APP_TOAST_MESSAGE

          toast({
            message,
            tone: "info",
            placement: "center",
          })
        })
        .subscribe()
    }

    void subscribe()

    return () => {
      active = false

      if (channel) {
        void supabase.removeChannel(channel)
      }
    }
  }, [toast])

  return null
}
