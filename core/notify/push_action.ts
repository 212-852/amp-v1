import type { Session } from "@/core/auth/types"
import { upsertPushContact } from "@/core/contacts/action"
import { getRestConfig, readRestError, restHeaders, restUrl } from "@/core/db/rest"
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
  const subscription = normalizePushSubscription(
    input.subscription,
    input.user_agent,
  )
  const subscription_value =
    input.subscription && typeof input.subscription === "object"
      ? JSON.stringify(input.subscription)
      : subscription.endpoint

  await upsertPushContact({
    user_uuid: input.session.user_uuid,
    visitor_uuid: input.session.visitor_uuid,
    endpoint: subscription.endpoint,
    value: subscription_value,
    p256dh: subscription.p256dh,
    auth: subscription.auth,
    user_agent: subscription.user_agent,
  })

  await disableLineSubscriptions({ session: input.session })

  return {
    notification_type: "pwa_push" as const,
    endpoint: subscription.endpoint,
  }
}

export async function disableLineSubscriptions(input: { session: Session }) {
  const config = getRestConfig()

  if (!config) {
    return
  }

  const identity_filter = input.session.user_uuid
    ? `user_uuid=eq.${encodeURIComponent(input.session.user_uuid)}`
    : input.session.visitor_uuid
      ? `visitor_uuid=eq.${encodeURIComponent(input.session.visitor_uuid)}`
      : null

  if (!identity_filter) {
    return
  }

  const response = await fetch(
    restUrl(config, "contacts", `${identity_filter}&type=eq.line`),
    {
      method: "PATCH",
      headers: restHeaders(config),
      body: JSON.stringify({
        receive: false,
      }),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    const error = await readRestError(response)
    throw new Error(error.message ?? "Failed to disable line subscription")
  }
}

export async function enableLineSubscriptions(input: { session: Session }) {
  const config = getRestConfig()

  if (!config) {
    return
  }

  const identity_filter = input.session.user_uuid
    ? `user_uuid=eq.${encodeURIComponent(input.session.user_uuid)}`
    : input.session.visitor_uuid
      ? `visitor_uuid=eq.${encodeURIComponent(input.session.visitor_uuid)}`
      : null

  if (!identity_filter) {
    return
  }

  const response = await fetch(
    restUrl(config, "contacts", `${identity_filter}&type=eq.line`),
    {
      method: "PATCH",
      headers: restHeaders(config),
      body: JSON.stringify({
        receive: true,
      }),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    const error = await readRestError(response)
    throw new Error(error.message ?? "Failed to enable line subscription")
  }
}

export async function disablePushSubscriptions(input: { session: Session }) {
  const config = getRestConfig()

  if (!config) {
    return
  }

  const identity_filter = input.session.user_uuid
    ? `user_uuid=eq.${encodeURIComponent(input.session.user_uuid)}`
    : input.session.visitor_uuid
      ? `visitor_uuid=eq.${encodeURIComponent(input.session.visitor_uuid)}`
      : null

  if (!identity_filter) {
    return
  }

  const response = await fetch(
    restUrl(config, "contacts", `${identity_filter}&type=eq.push`),
    {
      method: "PATCH",
      headers: restHeaders(config),
      body: JSON.stringify({
        receive: false,
        state: "offline",
      }),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    const error = await readRestError(response)
    throw new Error(error.message ?? "Failed to disable push subscription")
  }
}
