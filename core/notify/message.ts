export const NOTIFICATION_PREVIEW_MAX_LENGTH = 60

export const NOTIFICATION_ATTACHMENT_PREVIEW_BODIES = {
  image: "画像を受信しました",
  file: "ファイルを受信しました",
  stamp: "スタンプを受信しました",
} as const

export type NotificationPreviewMessage = {
  sender_name: string
  type?: string | null
  body?: string | null
}

export type NotificationPreview = {
  title: string
  body: string
}

function stripHtmlTags(value: string) {
  return value.replace(/<[^>]*>/g, "")
}

export function normalizeNotificationBodyText(value: string) {
  return stripHtmlTags(value)
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function truncateNotificationBody(
  value: string,
  max_length = NOTIFICATION_PREVIEW_MAX_LENGTH,
) {
  if (value.length <= max_length) {
    return value
  }

  return `${value.slice(0, max_length)}…`
}

function resolveAttachmentPreviewBody(type: string | null | undefined) {
  if (type === "image") {
    return NOTIFICATION_ATTACHMENT_PREVIEW_BODIES.image
  }

  if (type === "file") {
    return NOTIFICATION_ATTACHMENT_PREVIEW_BODIES.file
  }

  if (type === "stamp" || type === "sticker") {
    return NOTIFICATION_ATTACHMENT_PREVIEW_BODIES.stamp
  }

  return null
}

export function create_notification_preview(
  message: NotificationPreviewMessage,
): NotificationPreview {
  const sender_name = message.sender_name?.trim() || "ユーザー"
  const title = `${sender_name}から新着メッセージ`
  const attachment_body = resolveAttachmentPreviewBody(message.type)

  if (attachment_body) {
    return { title, body: attachment_body }
  }

  const normalized = normalizeNotificationBodyText(message.body ?? "")

  if (normalized) {
    return {
      title,
      body: truncateNotificationBody(normalized),
    }
  }

  return {
    title,
    body: "メッセージを受信しました",
  }
}
