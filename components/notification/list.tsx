"use client"

import { notification_text } from "@/components/notification/content"
import { useLocale } from "@/src/components/locale/provider"

export type NotificationListItem = {
  notification_uuid: string
  kind: string
  title: string
  body?: string | null
  created_at: string
}

type NotificationListProps = {
  items: NotificationListItem[]
}

function format_created_at(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ""
  }

  return date.toLocaleString()
}

export default function NotificationList({
  items,
}: Readonly<NotificationListProps>) {
  const { locale } = useLocale()

  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-neutral-200 px-4 py-8 text-center text-[13px] text-neutral-500">
        {notification_text("list_empty", locale)}
      </p>
    )
  }

  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li
          key={item.notification_uuid}
          className="rounded-xl border border-neutral-200 bg-white px-4 py-3"
        >
          <p className="text-[14px] font-medium text-neutral-900">{item.title}</p>
          {item.body ? (
            <p className="mt-1 text-[12px] leading-5 text-neutral-600">
              {item.body}
            </p>
          ) : null}
          {item.created_at ? (
            <p className="mt-2 text-[11px] text-neutral-400">
              {format_created_at(item.created_at)}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  )
}
