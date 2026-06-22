"use client"

import type { NotificationTab } from "@/components/notification/screen"
import { notification_text } from "@/components/notification/content"
import { useLocale } from "@/src/components/locale/provider"

type NotificationTabsProps = {
  active_tab: NotificationTab
  on_change: (tab: NotificationTab) => void
}

export default function NotificationTabs({
  active_tab,
  on_change,
}: Readonly<NotificationTabsProps>) {
  const { locale } = useLocale()

  const tabs: Array<{ id: NotificationTab; label: string }> = [
    {
      id: "notifications",
      label: notification_text("tab_notifications", locale),
    },
    {
      id: "settings",
      label: notification_text("tab_settings", locale),
    },
  ]

  return (
    <div className="mb-4 flex rounded-xl bg-neutral-100 p-1">
      {tabs.map((tab) => {
        const active = active_tab === tab.id

        return (
          <button
            key={tab.id}
            type="button"
            aria-pressed={active}
            onClick={() => on_change(tab.id)}
            className={[
              "flex-1 rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors",
              active
                ? "bg-white text-neutral-950 shadow-sm"
                : "text-neutral-500 hover:text-neutral-800",
            ].join(" ")}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
