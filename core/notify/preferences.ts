import type { Session } from "@/core/auth/types"
import type { NotificationType } from "@/core/chat/types"
import {
  loadIdentityNotificationContacts,
  resolveNotificationTypeFromContacts,
} from "@/core/notify/contact_preferences"
import {
  disablePushSubscriptions,
  enableLineSubscriptions,
  savePushSubscription,
} from "@/core/notify/push_action"

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
  session?: Pick<Session, "user_uuid" | "visitor_uuid"> | null,
) {
  if (!session?.user_uuid && !session?.visitor_uuid) {
    return { notification_type: "line" as const }
  }

  const contacts = await loadIdentityNotificationContacts(session)

  return {
    notification_type: resolveNotificationTypeFromContacts(contacts),
  }
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

  if (notification_type === "pwa_push") {
    const push_endpoint = normalizePushEndpoint(input.push_subscription)

    if (!push_endpoint) {
      throw new Error("push_subscription_required")
    }

    const result = await savePushSubscription({
      session: input.session,
      subscription: input.push_subscription,
      user_agent: null,
    })

    return {
      notification_type: "pwa_push" as const,
      endpoint: result.endpoint,
    }
  }

  await disablePushSubscriptions({ session: input.session })
  await enableLineSubscriptions({ session: input.session })

  return { notification_type: "line" as const }
}
