import type { NotificationType } from "@/core/chat/types"
import type { ChatLocale } from "@/core/chat/types"
import {
  resolveNotificationPageRules,
  shouldShowAvailabilitySettings,
  type NotificationHistoryRecord,
} from "@/core/notify/settings_rules"

const history_kind_labels: Record<
  NotificationHistoryRecord["kind"],
  Record<ChatLocale, string>
> = {
  new_message: {
    ja: "新着メッセージ",
    en: "New message",
    es: "Nuevo mensaje",
  },
  reservation_confirmed: {
    ja: "予約が確定しました",
    en: "Reservation confirmed",
    es: "Reserva confirmada",
  },
  reservation_changed: {
    ja: "予約が変更されました",
    en: "Reservation updated",
    es: "Reserva actualizada",
  },
  system: {
    ja: "システム通知",
    en: "System notification",
    es: "Notificacion del sistema",
  },
}

function toChatLocale(locale: string): ChatLocale {
  if (locale === "en" || locale === "es") {
    return locale
  }

  return "ja"
}

export function resolveNotificationHistoryLabel(
  kind: NotificationHistoryRecord["kind"],
  locale: string,
) {
  const chat_locale = toChatLocale(locale)
  return history_kind_labels[kind][chat_locale] ?? history_kind_labels[kind].ja
}

export function buildNotificationHistoryItems(input: {
  history: NotificationHistoryRecord[]
  locale: string
}) {
  return input.history.map((item) => ({
    notification_uuid: item.notification_uuid,
    kind: item.kind,
    title: item.title.trim() || resolveNotificationHistoryLabel(item.kind, input.locale),
    body: item.body?.trim() || null,
    created_at: item.created_at,
  }))
}

export function buildNotificationPageOutput(input: {
  role: string
  tier?: string | null
  notification_type: NotificationType
  availability_enabled: boolean
  history: NotificationHistoryRecord[]
  locale: string
}) {
  const rules = resolveNotificationPageRules({
    role: input.role,
    tier: input.tier ?? null,
    availability_enabled: input.availability_enabled,
    notification_type: input.notification_type,
  })

  return {
    notification_type: rules.notification_type,
    availability: {
      enabled: rules.availability_enabled,
      can_toggle: rules.can_toggle_availability,
      visible: shouldShowAvailabilitySettings(rules),
    },
    history: buildNotificationHistoryItems({
      history: input.history,
      locale: input.locale,
    }),
  }
}
