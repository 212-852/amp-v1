import type { Session } from "@/core/auth/types"
import { getRestConfig, readRestError, restHeaders, restUrl } from "@/core/db/rest"
import {
  loadIdentityNotificationContact,
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
  const contact = contacts[0]

  return (
    contacts.length === 1 &&
    contact?.type === "line" &&
    contact.receive === true &&
    Boolean(contact.value?.trim())
  )
}

function hasReceivingPushContact(contacts: NotificationContactRow[]) {
  const contact = contacts[0]

  return (
    contacts.length === 1 &&
    contact?.type === "push" &&
    contact.receive === true &&
    Boolean(contact.endpoint?.trim()) &&
    Boolean(contact.p256dh?.trim()) &&
    Boolean(contact.auth?.trim())
  )
}

async function deleteOtherNotificationContacts(input: {
  session: Pick<Session, "user_uuid" | "visitor_uuid">
  keep_contact_uuid: string | null
}) {
  const { config, filter } = requireNotificationContactTarget(input.session)
  const keep_filter = input.keep_contact_uuid
    ? `&contact_uuid=neq.${encodeURIComponent(input.keep_contact_uuid)}`
    : ""

  const response = await fetch(
    restUrl(
      config,
      "contacts",
      `${filter}${keep_filter}&select=contact_uuid`,
    ),
    {
      method: "DELETE",
      headers: {
        ...restHeaders(config),
        Prefer: "return=representation",
      },
      cache: "no-store",
    },
  )

  if (!response.ok) {
    const error = await readRestError(response)
    throw new Error(error.message ?? "Failed to delete duplicate notification contacts")
  }

  const rows = (await response.json().catch(() => [])) as unknown[]
  return rows.length
}

async function saveSingleNotificationContact(input: {
  session: Pick<Session, "user_uuid" | "visitor_uuid">
  contact_uuid?: string | null
  body: Record<string, unknown>
}) {
  const { config } = requireNotificationContactTarget(input.session)
  const now = new Date().toISOString()
  const identity =
    input.session.user_uuid
      ? { user_uuid: input.session.user_uuid, visitor_uuid: null }
      : { user_uuid: null, visitor_uuid: input.session.visitor_uuid }
  const body = {
    ...identity,
    value: null,
    receive: true,
    updated_at: now,
    ...input.body,
  }
  const existing_contact_uuid =
    input.contact_uuid ??
    (await loadIdentityNotificationContact(input.session))?.contact_uuid ??
    null

  if (existing_contact_uuid) {
    const response = await fetch(
      restUrl(
        config,
        "contacts",
        `contact_uuid=eq.${encodeURIComponent(existing_contact_uuid)}&select=contact_uuid,type,receive,channel,state,updated_at`,
      ),
      {
        method: "PATCH",
        headers: {
          ...restHeaders(config),
          Prefer: "return=representation",
        },
        body: JSON.stringify(body),
        cache: "no-store",
      },
    )

    if (!response.ok) {
      const error = await readRestError(response)
      throw new Error(error.message ?? "Failed to update notification contact")
    }

    const rows = (await response.json()) as NotificationContactRow[]
    const saved = rows[0] ?? null
    const deleted_rows = await deleteOtherNotificationContacts({
      session: input.session,
      keep_contact_uuid: saved?.contact_uuid ?? existing_contact_uuid,
    })

    return {
      contact: saved,
      affected_rows: rows.length + deleted_rows,
    }
  }

  const response = await fetch(
    restUrl(
      config,
      "contacts",
      "select=contact_uuid,type,receive,channel,state,updated_at",
    ),
    {
      method: "POST",
      headers: {
        ...restHeaders(config),
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        ...body,
        created_at: now,
      }),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    const error = await readRestError(response)
    throw new Error(error.message ?? "Failed to create notification contact")
  }

  const rows = (await response.json()) as NotificationContactRow[]
  const saved = rows[0] ?? null
  const deleted_rows = await deleteOtherNotificationContacts({
    session: input.session,
    keep_contact_uuid: saved?.contact_uuid ?? null,
  })

  return {
    contact: saved,
    affected_rows: rows.length + deleted_rows,
  }
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

async function loadLineProviderUserId(user_uuid: string) {
  const config = getRestConfig()

  if (!config) {
    return null
  }

  const response = await fetch(
    restUrl(
      config,
      "identities",
      [
        `user_uuid=eq.${encodeURIComponent(user_uuid)}`,
        "provider=eq.line",
        "provider_user_id=not.is.null",
        "select=provider_user_id",
        "order=created_at.desc",
        "limit=1",
      ].join("&"),
    ),
    {
      headers: restHeaders(config),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    return null
  }

  const rows = (await response.json()) as Array<{
    provider_user_id?: string | null
  }>

  return rows[0]?.provider_user_id?.trim() || null
}

export async function saveLineNotificationSettings(input: { session: Session }) {
  if (!input.session.user_uuid) {
    throw new Error("line_notification_requires_user")
  }

  const provider_user_id = await loadLineProviderUserId(input.session.user_uuid)

  if (!provider_user_id) {
    throw new Error("line_provider_user_id_missing")
  }

  const before_contacts = await loadIdentityNotificationContacts(input.session)
  const existing_contact = await loadIdentityNotificationContact(input.session)

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

  const saved = await saveSingleNotificationContact({
    session: input.session,
    contact_uuid: existing_contact?.contact_uuid ?? null,
    body: {
      type: "line",
      channel: "line",
      receive: true,
      value: provider_user_id,
      endpoint: null,
      p256dh: null,
      auth: null,
      user_agent: null,
    },
  })
  const affected_rows = saved.affected_rows
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
    !hasReceivingLineContact(after_contacts)
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
    const saved = await saveSingleNotificationContact({
      session: input.session,
      body: {
        type: "push",
        value: subscription.endpoint,
        channel: "pwa",
        state: "active",
        endpoint: subscription.endpoint,
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      },
    })
    const saved_contact = saved.contact
    const affected_rows = saved.affected_rows
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
      !hasReceivingPushContact(after_contacts)
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
      contact_uuid: saved_contact?.contact_uuid ?? null,
      selected_channel: "push",
      receive: saved_contact?.receive ?? null,
      state: saved_contact?.state ?? null,
      channel: saved_contact?.channel ?? null,
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
