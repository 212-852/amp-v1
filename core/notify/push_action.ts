import { getRestConfig, readRestError, restHeaders, restUrl } from "@/core/db/rest"
import type { Session } from "@/core/auth/types"
import { save_profile_settings } from "@/core/profile/action"
import {
  normalizePushSubscription,
  resolvePushPublicKeyConfig,
  resolvePushPublicKey,
} from "@/core/notify/push_rules"

export async function getPushNotificationPublicKey() {
  return resolvePushPublicKey()
}

export async function getPushNotificationPublicKeyConfig() {
  return resolvePushPublicKeyConfig()
}

export async function savePushSubscription(input: {
  session: Session
  subscription: unknown
  user_agent: string | null
}) {
  const config = getRestConfig()
  const subscription = normalizePushSubscription(
    input.subscription,
    input.user_agent,
  )

  if (!input.session.user_uuid && !input.session.visitor_uuid) {
    throw new Error("push_subscription_requires_identity")
  }

  if (config) {
    const response = await fetch(
      restUrl(config, "push_subscriptions", "on_conflict=endpoint&select=*"),
      {
        method: "POST",
        headers: {
          ...restHeaders(config),
          Prefer: "resolution=merge-duplicates,return=representation",
        },
        body: JSON.stringify({
          user_uuid: input.session.user_uuid,
          visitor_uuid: input.session.visitor_uuid,
          endpoint: subscription.endpoint,
          p256dh: subscription.p256dh,
          auth: subscription.auth,
          user_agent: subscription.user_agent,
          enabled: true,
        }),
        cache: "no-store",
      },
    )

    if (!response.ok) {
      const error = await readRestError(response)
      throw new Error(error.message ?? "Failed to save push subscription")
    }
  }

  await save_profile_settings({
    session: input.session,
    body: { notification_type: "pwa_push" },
  })

  return {
    notification_type: "pwa_push" as const,
    endpoint: subscription.endpoint,
  }
}
