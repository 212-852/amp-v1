import type { Session } from "@/core/auth/types"
import { upsertPushContact } from "@/core/contacts/action"
import { getRestConfig, readRestError, restHeaders, restUrl } from "@/core/db/rest"
import { sendNotifyDebug } from "@/core/notify/debug"
import {
  normalizePushSubscription,
  resolvePushPublicKeyConfig,
  resolvePushPublicKey,
} from "@/core/notify/push_rules"

export async function getPushNotificationPublicKey() {
  const public_key = resolvePushPublicKey()

  await sendNotifyDebug("push_public_key_resolved", {
    has_public_key: Boolean(public_key),
  })

  return public_key
}

export async function getPushNotificationPublicKeyConfig() {
  const config = resolvePushPublicKeyConfig()

  await sendNotifyDebug("push_public_key_resolved", {
    has_public_key: Boolean(config.public_key),
    missing_env: config.missing_env,
  })

  return config
}

export async function savePushSubscription(input: {
  session: Session
  subscription: unknown
  user_agent: string | null
}) {
  await sendNotifyDebug("push_subscription_save_started", {
    user_uuid: input.session.user_uuid,
    visitor_uuid: input.session.visitor_uuid,
    channel: "pwa",
  })

  try {
    const subscription = normalizePushSubscription(
      input.subscription,
      input.user_agent,
    )
    const subscription_value =
      input.subscription && typeof input.subscription === "object"
        ? JSON.stringify(input.subscription)
        : JSON.stringify({
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          })

    const contact = await upsertPushContact({
      user_uuid: input.session.user_uuid,
      visitor_uuid: input.session.visitor_uuid,
      endpoint: subscription.endpoint,
      value: subscription_value,
      p256dh: subscription.p256dh,
      auth: subscription.auth,
      user_agent: subscription.user_agent,
      channel: "pwa",
      receive: true,
    })

    await disableLineSubscriptions({ session: input.session })

    await sendNotifyDebug("push_subscription_save_success", {
      user_uuid: input.session.user_uuid,
      visitor_uuid: input.session.visitor_uuid,
      contact_uuid: contact?.contact_uuid ?? null,
      selected_channel: "push",
      receive: contact?.receive ?? true,
      state: contact?.state ?? null,
      channel: contact?.channel ?? "pwa",
      has_value: true,
    })

    return {
      notification_type: "pwa_push" as const,
      endpoint: subscription.endpoint,
    }
  } catch (error) {
    await sendNotifyDebug("push_subscription_save_failed", {
      user_uuid: input.session.user_uuid,
      visitor_uuid: input.session.visitor_uuid,
      channel: "pwa",
      reason: error instanceof Error ? error.message : String(error),
    })

    throw error
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
