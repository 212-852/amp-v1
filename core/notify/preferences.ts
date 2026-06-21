import { upsertContact } from "@/core/contacts/action"
import type { Session } from "@/core/auth/types"
import type { NotificationType } from "@/core/chat/types"
import {
  load_profile_notification_type,
  save_profile_settings,
} from "@/core/profile/action"

export type PushSubscriptionInput = {
  endpoint?: unknown
}

export function normalizeNotificationType(value: unknown): NotificationType | null {
  if (value === "line" || value === "pwa_push") {
    return value
  }

  return value === "push" ? "pwa_push" : null
}

function normalizePushEndpoint(value: unknown) {
  if (!value || typeof value !== "object") {
    return null
  }

  const endpoint = (value as PushSubscriptionInput).endpoint

  if (typeof endpoint !== "string" || !endpoint.trim()) {
    return null
  }

  return endpoint.trim()
}

export async function getNotificationSettings(
  session?: Pick<Session, "user_uuid"> | null,
) {
  if (!session?.user_uuid) {
    return { notification_type: "line" as const }
  }

  const notification_type = await load_profile_notification_type(session.user_uuid)
  return { notification_type }
}

export async function saveNotificationSettings(input: {
  session: Session
  notification_type: NotificationType
  push_subscription?: unknown
}) {
  const notification_type = normalizeNotificationType(input.notification_type)

  if (!notification_type) {
    throw new Error("notification_type_required")
  }

  const profile = await save_profile_settings({
    session: input.session,
    body: { notification_type },
  })

  if (notification_type === "pwa_push") {
    const push_endpoint = normalizePushEndpoint(input.push_subscription)

    if (!push_endpoint) {
      throw new Error("push_subscription_required")
    }

    await upsertContact({
      user_uuid: input.session.user_uuid,
      visitor_uuid: input.session.visitor_uuid,
      type: "push",
      value: push_endpoint,
      channel: "pwa",
      receive: true,
    })
  }

  return {
    notification_type:
      profile.notification_type === "pwa_push" ? "pwa_push" : "line",
  }
}

export async function loadNotificationTypeForUser(user_uuid: string | null) {
  if (!user_uuid) {
    return "line" as const
  }

  return load_profile_notification_type(user_uuid)
}

