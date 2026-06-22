"use client"

import { useEffect, useState } from "react"

import NotificationList, {
  type NotificationListItem,
} from "@/components/notification/list"
import NotificationSettings from "@/components/notification/settings"
import NotificationTabs from "@/components/notification/tabs"
import type { NotificationType } from "@/core/chat/types"

export type NotificationTab = "notifications" | "settings"

export type NotificationPageState = {
  notification_type: NotificationType
  availability: {
    enabled: boolean
    can_toggle: boolean
    visible: boolean
  }
  history: NotificationListItem[]
}

type NotificationScreenProps = {
  initial_tab?: NotificationTab
  initial_state?: NotificationPageState | null
  onSaved?: (notification_type: NotificationType) => void
}

const default_state: NotificationPageState = {
  notification_type: "line",
  availability: {
    enabled: false,
    can_toggle: false,
    visible: false,
  },
  history: [],
}

export default function NotificationScreen({
  initial_tab = "notifications",
  initial_state = null,
  onSaved,
}: Readonly<NotificationScreenProps>) {
  const [active_tab, set_active_tab] = useState<NotificationTab>(initial_tab)
  const [page_state, set_page_state] = useState<NotificationPageState>(
    initial_state ?? default_state,
  )
  const [is_loading, set_is_loading] = useState(!initial_state)

  useEffect(() => {
    if (initial_state) {
      set_page_state(initial_state)
      set_is_loading(false)
      return
    }

    let cancelled = false

    async function load_page() {
      set_is_loading(true)

      const response = await fetch("/api/notify/page", {
        credentials: "include",
        cache: "no-store",
      }).catch(() => null)

      if (!response?.ok || cancelled) {
        if (!cancelled) {
          set_is_loading(false)
        }
        return
      }

      const payload = (await response.json().catch(() => null)) as
        | ({ ok?: boolean } & NotificationPageState)
        | null

      if (!cancelled && payload?.ok) {
        set_page_state({
          notification_type: payload.notification_type,
          availability: payload.availability,
          history: payload.history ?? [],
        })
      }

      if (!cancelled) {
        set_is_loading(false)
      }
    }

    void load_page()

    return () => {
      cancelled = true
    }
  }, [initial_state])

  return (
    <div>
      <NotificationTabs active_tab={active_tab} on_change={set_active_tab} />

      {is_loading ? (
        <p className="px-1 py-6 text-center text-[13px] text-neutral-500">
          ...
        </p>
      ) : active_tab === "notifications" ? (
        <NotificationList items={page_state.history} />
      ) : (
        <NotificationSettings
          initial_notification_type={page_state.notification_type}
          availability_enabled={page_state.availability.enabled}
          availability_can_toggle={page_state.availability.can_toggle}
          onSaved={(notification_type) => {
            set_page_state((current) => ({
              ...current,
              notification_type,
            }))
            onSaved?.(notification_type)
          }}
          onAvailabilityChanged={(enabled) => {
            set_page_state((current) => ({
              ...current,
              availability: {
                ...current.availability,
                enabled,
              },
            }))
          }}
        />
      )}
    </div>
  )
}
