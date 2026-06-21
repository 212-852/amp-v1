import type { Session } from "@/core/auth/types"
import { upsertPushContact } from "@/core/contacts/action"
import { getRestConfig, readRestError, restHeaders, restUrl } from "@/core/db/rest"
import { sendNotifyDebug } from "@/core/notify/debug"
import {
  normalizePushSubscription,
  resolvePushPublicKeyConfig,
  resolvePushPublicKey,
} from "@/core/notify/push_rules"
import { save_profile_settings } from "@/core/profile/action"

function identityFilter(session: Pick<Session, "user_uuid" | "visitor_uuid">) {
  if (session.user_uuid) {
    return `user_uuid=eq.${encodeURIComponent(session.user_uuid)}`
  }

  if (session.visitor_uuid) {
    return `visitor_uuid=eq.${encodeURIComponent(session.visitor_uuid)}`
  }

  return null
}

function requireNotificationContactTarget(
  session: Pick<Session, "user_uuid" | "visitor_uuid">,
) {
  const config = getRestConfig()
  const filter = identityFilter(session)

  if (!config) {
    throw new Error("notification_contacts_db_unavailable")
  }

  if (!filter) {
    throw new Error("notification_contact_identity_required")
  }

  return { config, filter }
}

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

export async function saveLineNotificationSettings(input: { session: Session }) {
  await sendNotifyDebug("line_notification_settings_save_started", {
    user_uuid: input.session.user_uuid,
    visitor_uuid: input.session.visitor_uuid,
  })

  await disablePushSubscriptions({ session: input.session })
  await enableLineSubscriptions({ session: input.session })

  if (input.session.user_uuid) {
    await save_profile_settings({
      session: input.session,
      body: { notification_type: "line" },
    })
  }

  await sendNotifyDebug("line_notification_settings_save_success", {
    user_uuid: input.session.user_uuid,
    visitor_uuid: input.session.visitor_uuid,
  })

  return { notification_type: "line" as const }
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
    const subscription_value = JSON.stringify(
      input.subscription && typeof input.subscription === "object"
        ? input.subscription
        : {
            endpoint: subscription.endpoint,
            expirationTime: null,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          },
    )
    const now = new Date().toISOString()

    const contact = await upsertPushContact({
      user_uuid: input.session.user_uuid,
      visitor_uuid: input.session.visitor_uuid,
      endpoint: subscription.endpoint,
      value: subscription_value,
      p256dh: subscription.p256dh,
      auth: subscription.auth,
      user_agent: subscription.user_agent,
      channel: "pwa",
      state: "active",
      receive: true,
      last_seen_at: now,
      updated_at: now,
    })

    await disableLineSubscriptions({ session: input.session })

    if (input.session.user_uuid) {
      await save_profile_settings({
        session: input.session,
        body: { notification_type: "pwa_push" },
      })
    }

    await sendNotifyDebug("push_subscription_save_success", {
      user_uuid: input.session.user_uuid,
      visitor_uuid: input.session.visitor_uuid,
      contact_uuid: contact?.contact_uuid ?? null,
      selected_channel: "push",
      receive: contact?.receive ?? true,
      state: contact?.state ?? "active",
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
  const { config, filter } = requireNotificationContactTarget(input.session)

  const response = await fetch(
    restUrl(config, "contacts", `${filter}&type=eq.line`),
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
  const { config, filter } = requireNotificationContactTarget(input.session)

  const response = await fetch(
    restUrl(config, "contacts", `${filter}&type=eq.line`),
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
  const { config, filter } = requireNotificationContactTarget(input.session)

  const now = new Date().toISOString()
  const response = await fetch(
    restUrl(config, "contacts", `${filter}&type=eq.push`),
    {
      method: "PATCH",
      headers: restHeaders(config),
      body: JSON.stringify({
        receive: false,
        state: "offline",
        last_seen_at: now,
        updated_at: now,
      }),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    const error = await readRestError(response)
    throw new Error(error.message ?? "Failed to disable push subscription")
  }
}
