import type { Session } from "@/core/auth/types"
import {
  loadPushContactByEndpoint,
  upsertPushContact,
} from "@/core/contacts/action"
import { getRestConfig, readRestError, restHeaders, restUrl } from "@/core/db/rest"
import {
  loadIdentityNotificationContacts,
  resolveNotificationTypeFromContacts,
  type NotificationContactRow,
} from "@/core/notify/contact_preferences"
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

function serializeContacts(contacts: NotificationContactRow[]) {
  return contacts.map((contact) => ({
    contact_uuid: contact.contact_uuid ?? null,
    type: contact.type ?? null,
    channel: contact.channel ?? null,
    state: contact.state ?? null,
    receive: contact.receive ?? null,
    updated_at: contact.updated_at ?? null,
    has_value: Boolean(contact.value?.trim()),
    has_endpoint: Boolean(contact.endpoint?.trim()),
  }))
}

function hasReceivingLineContact(contacts: NotificationContactRow[]) {
  return contacts.some(
    (contact) => contact.type === "line" && contact.receive === true,
  )
}

function hasReceivingPushContact(contacts: NotificationContactRow[]) {
  return contacts.some(
    (contact) =>
      contact.type === "push" &&
      contact.receive === true &&
      contact.channel === "pwa",
  )
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
  const before_contacts = await loadIdentityNotificationContacts(input.session)

  await sendNotifyDebug("notification_setting_save_start", {
    user_uuid: input.session.user_uuid,
    visitor_uuid: input.session.visitor_uuid,
    selected_channel: "line",
    before: serializeContacts(before_contacts),
    after: null,
    affected_rows: 0,
  })
  await sendNotifyDebug("line_notification_settings_save_started", {
    user_uuid: input.session.user_uuid,
    visitor_uuid: input.session.visitor_uuid,
  })

  const push_affected_rows = await disablePushSubscriptions({ session: input.session })
  const line_affected_rows = await enableLineSubscriptions({ session: input.session })
  const affected_rows = push_affected_rows + line_affected_rows
  const after_contacts = await loadIdentityNotificationContacts(input.session)

  await sendNotifyDebug("notification_setting_contacts_updated", {
    user_uuid: input.session.user_uuid,
    visitor_uuid: input.session.visitor_uuid,
    selected_channel: "line",
    before: serializeContacts(before_contacts),
    after: serializeContacts(after_contacts),
    affected_rows,
  })

  await sendNotifyDebug("notification_setting_contacts_reload", {
    user_uuid: input.session.user_uuid,
    visitor_uuid: input.session.visitor_uuid,
    selected_channel: "line",
    before: serializeContacts(before_contacts),
    after: serializeContacts(after_contacts),
    affected_rows,
  })

  if (
    !hasReceivingLineContact(after_contacts) ||
    after_contacts.some(
      (contact) => contact.type === "push" && contact.receive === true,
    )
  ) {
    throw new Error("line_contact_receive_not_enabled")
  }

  await save_profile_settings({
    session: input.session,
    body: { notification_type: "line" },
  })

  await sendNotifyDebug("line_notification_settings_save_success", {
    user_uuid: input.session.user_uuid,
    visitor_uuid: input.session.visitor_uuid,
  })
  await sendNotifyDebug("notification_setting_save_success", {
    user_uuid: input.session.user_uuid,
    visitor_uuid: input.session.visitor_uuid,
    selected_channel: "line",
    before: serializeContacts(before_contacts),
    after: serializeContacts(after_contacts),
    affected_rows,
  })

  return { notification_type: resolveNotificationTypeFromContacts(after_contacts) }
}

export async function savePushSubscription(input: {
  session: Session
  subscription: unknown
  user_agent: string | null
}) {
  const before_contacts = await loadIdentityNotificationContacts(input.session)

  await sendNotifyDebug("notification_setting_save_start", {
    user_uuid: input.session.user_uuid,
    visitor_uuid: input.session.visitor_uuid,
    selected_channel: "push",
    before: serializeContacts(before_contacts),
    after: null,
    affected_rows: 0,
  })
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

    await upsertPushContact({
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

    const saved_contact = await loadPushContactByEndpoint(subscription.endpoint)

    if (
      saved_contact?.type !== "push" ||
      saved_contact.receive !== true ||
      saved_contact.channel !== "pwa" ||
      saved_contact.value !== subscription_value
    ) {
      throw new Error("push_contact_receive_not_enabled")
    }

    const line_affected_rows = await disableLineSubscriptions({
      session: input.session,
    })
    const affected_rows = 1 + line_affected_rows
    const after_contacts = await loadIdentityNotificationContacts(input.session)

    await sendNotifyDebug("notification_setting_contacts_updated", {
      user_uuid: input.session.user_uuid,
      visitor_uuid: input.session.visitor_uuid,
      selected_channel: "push",
      before: serializeContacts(before_contacts),
      after: serializeContacts(after_contacts),
      affected_rows,
    })

    await sendNotifyDebug("notification_setting_contacts_reload", {
      user_uuid: input.session.user_uuid,
      visitor_uuid: input.session.visitor_uuid,
      selected_channel: "push",
      before: serializeContacts(before_contacts),
      after: serializeContacts(after_contacts),
      affected_rows,
    })

    if (
      !hasReceivingPushContact(after_contacts) ||
      after_contacts.some(
        (contact) => contact.type === "line" && contact.receive === true,
      )
    ) {
      throw new Error("push_contact_receive_not_enabled")
    }

    await save_profile_settings({
      session: input.session,
      body: { notification_type: "pwa_push" },
    })

    await sendNotifyDebug("push_subscription_save_success", {
      user_uuid: input.session.user_uuid,
      visitor_uuid: input.session.visitor_uuid,
      contact_uuid: saved_contact.contact_uuid ?? null,
      selected_channel: "push",
      receive: saved_contact.receive,
      state: saved_contact.state,
      channel: saved_contact.channel,
      has_value: true,
    })
    await sendNotifyDebug("notification_setting_save_success", {
      user_uuid: input.session.user_uuid,
      visitor_uuid: input.session.visitor_uuid,
      selected_channel: "push",
      before: serializeContacts(before_contacts),
      after: serializeContacts(after_contacts),
      affected_rows,
    })

    return {
      notification_type: resolveNotificationTypeFromContacts(after_contacts),
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
  const now = new Date().toISOString()

  const response = await fetch(
    restUrl(
      config,
      "contacts",
      `${filter}&type=eq.line&select=contact_uuid,type,receive,channel,state,updated_at`,
    ),
    {
      method: "PATCH",
      headers: {
        ...restHeaders(config),
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        receive: false,
        updated_at: now,
      }),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    const error = await readRestError(response)
    throw new Error(error.message ?? "Failed to disable line subscription")
  }

  const rows = (await response.json().catch(() => [])) as unknown[]
  return rows.length
}

export async function enableLineSubscriptions(input: { session: Session }) {
  const { config, filter } = requireNotificationContactTarget(input.session)
  const now = new Date().toISOString()

  const response = await fetch(
    restUrl(
      config,
      "contacts",
      `${filter}&type=eq.line&select=contact_uuid,type,receive,channel,state,updated_at`,
    ),
    {
      method: "PATCH",
      headers: {
        ...restHeaders(config),
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        receive: true,
        updated_at: now,
      }),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    const error = await readRestError(response)
    throw new Error(error.message ?? "Failed to enable line subscription")
  }

  const rows = (await response.json().catch(() => [])) as unknown[]
  return rows.length
}

export async function disablePushSubscriptions(input: { session: Session }) {
  const { config, filter } = requireNotificationContactTarget(input.session)

  const now = new Date().toISOString()
  const response = await fetch(
    restUrl(
      config,
      "contacts",
      `${filter}&type=eq.push&select=contact_uuid,type,receive,channel,state,updated_at`,
    ),
    {
      method: "PATCH",
      headers: {
        ...restHeaders(config),
        Prefer: "return=representation",
      },
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

  const rows = (await response.json().catch(() => [])) as unknown[]
  return rows.length
}
