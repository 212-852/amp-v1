import type { Locale } from "@/src/lib/locale"

export const notification_content = {
  panel_title: {
    ja: "通知",
    en: "Notifications",
    es: "Notificaciones",
  },
  tab_notifications: {
    ja: "通知",
    en: "Notifications",
    es: "Notificaciones",
  },
  tab_settings: {
    ja: "設定",
    en: "Settings",
    es: "Ajustes",
  },
  list_empty: {
    ja: "通知はありません",
    en: "No notifications yet",
    es: "No hay notificaciones",
  },
  settings_method_title: {
    ja: "通知方法",
    en: "Notification method",
    es: "Metodo de notificacion",
  },
  settings_receive_title: {
    ja: "通知受信",
    en: "Receive notifications",
    es: "Recibir notificaciones",
  },
  line: {
    ja: "LINE",
    en: "LINE",
    es: "LINE",
  },
  push: {
    ja: "Push通知",
    en: "Push notifications",
    es: "Notificaciones push",
  },
  line_saved: {
    ja: "LINE通知へ変更しました",
    en: "Switched to LINE notifications",
    es: "Cambiado a notificaciones LINE",
  },
  push_saved: {
    ja: "PWA Push通知へ変更しました",
    en: "Switched to PWA Push notifications",
    es: "Cambiado a notificaciones push PWA",
  },
  push_disabled: {
    ja: "PWA Pushは現在選択できません",
    en: "PWA Push is not available right now",
    es: "Push PWA no esta disponible ahora",
  },
  push_denied: {
    ja: "通知許可が拒否されています",
    en: "Notification permission is denied",
    es: "El permiso de notificaciones esta denegado",
  },
  push_not_pwa: {
    ja: "PWAとして起動した時のみ選択できます",
    en: "Available only when launched as a PWA",
    es: "Disponible solo al iniciar como PWA",
  },
  push_unsupported: {
    ja: "このブラウザはPush通知に対応していません",
    en: "This browser does not support push notifications",
    es: "Este navegador no admite notificaciones push",
  },
  push_vapid_missing: {
    ja: "Push通知キーが未設定です",
    en: "Push notification key is not configured",
    es: "La clave push no esta configurada",
  },
  push_subscription_failed: {
    ja: "Push通知キーを取得できませんでした",
    en: "Failed to get push notification keys",
    es: "No se pudieron obtener las claves push",
  },
  line_identity_missing: {
    ja: "LINE連携情報が見つかりません",
    en: "LINE identity was not found",
    es: "No se encontro la identidad LINE",
  },
  save_failed: {
    ja: "通知設定の変更に失敗しました",
    en: "Failed to update notification settings",
    es: "Error al actualizar",
  },
} as const satisfies Record<string, Record<Locale, string>>

export function notification_text(
  key: keyof typeof notification_content,
  locale: Locale,
) {
  return notification_content[key][locale] ?? notification_content[key].ja
}
