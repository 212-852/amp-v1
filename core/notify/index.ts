import {
  hasNotifyBeenDelivered,
  markNotifyDelivered,
} from "@/core/notify/dedup"
import { sendNotifyDebug } from "@/core/notify/debug"
import {
  deliverDiscordNotification,
  notifyDiscord,
} from "@/core/notify/discord"
import {
  resolveNotifyDelivery,
  type NotifyEventInput,
} from "@/core/notify/rules"
import {
  buildChatNotificationContent,
  buildChatNotificationUrls,
  resolveChatNotifyDecision,
  type ChatNotificationContactType,
  type ChatNotifyReceiverRole,
  type ChatNotifySenderRole,
} from "@/core/notify/chat_rules"
import { deliverChatLineNotification } from "@/core/notify/line"
import { deliverChatPushNotification } from "@/core/notify/push"
import type { ChatMessageNotifyInput } from "@/core/notify/types"

export type NotifyMessage = {
  channel: "discord"
  title: string
  event: string
  request_id?: string | null
  payload: Record<string, unknown>
}

export type NotifyEventResult = {
  delivered: boolean
  reason?: string
  thread_id?: string | null
  thread_status?: "open" | "closed" | null
  http_status?: number | null
}

async function logNotifyDebug(
  event: string,
  payload: Record<string, unknown>,
) {
  await sendNotifyDebug(event, payload, payload.request_id as string | null)
}

type NotifyContactRow = {
  type?: string | null
  value?: string | null
  endpoint?: string | null
  channel?: string | null
  state?: string | null
  receive?: boolean | null
  last_seen_at?: string | null
  updated_at?: string | null
}

type ResolvedNotifyContact = {
  type: ChatNotificationContactType
  value: string
}

function isReceiverActive(contact: NotifyContactRow, now = new Date()) {
  if (
    contact.channel !== "web" &&
    contact.channel !== "pwa" &&
    contact.channel !== "liff"
  ) {
    return false
  }

  if (contact.state !== "active" || !contact.last_seen_at) {
    return false
  }

  const last_seen_time = Date.parse(contact.last_seen_at)

  return (
    Number.isFinite(last_seen_time) &&
    now.getTime() - last_seen_time <= 60 * 1000
  )
}

function resolveContactValue(contact: NotifyContactRow) {
  if (contact.type === "push") {
    const raw_value = contact.endpoint?.trim() || contact.value?.trim() || ""

    if (!raw_value) {
      return null
    }

    try {
      const parsed = JSON.parse(raw_value) as { endpoint?: unknown }

      if (typeof parsed.endpoint === "string" && parsed.endpoint.trim()) {
        return parsed.endpoint.trim()
      }
    } catch {
      // contacts.value can be either endpoint text or subscription JSON.
    }

    return raw_value
  }

  return contact.value?.trim() || null
}

function selectDeliveryContact(
  contacts: NotifyContactRow[],
): ResolvedNotifyContact | null {
  const contact = contacts.find(
    (row) =>
      row.receive === true &&
      (row.type === "line" || row.type === "push") &&
      Boolean(resolveContactValue(row)),
  )

  if (!contact || (contact.type !== "line" && contact.type !== "push")) {
    return null
  }

  const value = resolveContactValue(contact)

  if (!value) {
    return null
  }

  return {
    type: contact.type,
    value,
  }
}

async function loadReceiverNotificationState(input: {
  user_uuid: string
}): Promise<{
  receiver_active: boolean
  contact: ResolvedNotifyContact | null
}> {
  const { getRestConfig, restHeaders, restUrl } = await import("@/core/db/rest")
  const config = getRestConfig()

  if (!config) {
    return { receiver_active: false, contact: null }
  }

  const filter = [
    `user_uuid=eq.${encodeURIComponent(input.user_uuid)}`,
    "type=in.(line,push)",
    "select=type,value,endpoint,channel,state,receive,last_seen_at,updated_at",
    "order=updated_at.desc",
  ].join("&")

  const response = await fetch(restUrl(config, "contacts", filter), {
    headers: restHeaders(config),
    cache: "no-store",
  })

  if (!response.ok) {
    return { receiver_active: false, contact: null }
  }

  const contacts = (await response.json()) as NotifyContactRow[]

  return {
    receiver_active: contacts.some((contact) => isReceiverActive(contact)),
    contact: selectDeliveryContact(contacts),
  }
}

export async function notifyChatMessageReceived(input: ChatMessageNotifyInput) {
  const request_id =
    input.request_id ?? `chat_notify:${input.room_uuid}:${Date.now()}`

  await sendNotifyDebug("notification_requested", {
    room_uuid: input.room_uuid,
    sender_role: input.sender_role,
    receiver_role: input.receiver_role ?? "concierge",
    request_id,
  })

  const {
    loadEnabledAvailabilityRecipients,
  } = await import("@/core/chat/archive")

  const recipients = await loadEnabledAvailabilityRecipients()
  const content = buildChatNotificationContent({
    user_name: input.user_name,
    room_uuid: input.room_uuid,
  })
  const notification_urls = buildChatNotificationUrls({
    room_uuid: input.room_uuid,
  })
  const sender_role = input.sender_role as ChatNotifySenderRole
  const receiver_role = (input.receiver_role ?? "concierge") as ChatNotifyReceiverRole

  let delivered_count = 0

  for (const recipient of recipients) {
    const receiver_state = await loadReceiverNotificationState({
      user_uuid: recipient.user_uuid,
    })
    const decision = resolveChatNotifyDecision({
      availability: "on",
      sender_role,
      receiver_role,
      receiver_active: receiver_state.receiver_active,
      contact_type: receiver_state.contact?.type ?? null,
    })

    if (!decision.should_notify) {
      const debug_event =
        decision.skip_reason === "availability_off"
          ? "notification_skipped_availability_off"
          : decision.skip_reason === "receiver_active"
            ? "notification_skipped_receiver_active"
            : decision.skip_reason === "missing_contact"
              ? "notification_skipped_missing_contact"
              : "notification_skipped_invalid_sender"

      await sendNotifyDebug(debug_event, {
        room_uuid: input.room_uuid,
        receiver_user_uuid: recipient.user_uuid,
        sender_role,
        receiver_role,
        request_id,
      })
      continue
    }

    const payload = {
      ...content,
      receiver_user_uuid: recipient.user_uuid,
    }

    if (receiver_state.contact?.type === "line") {
      const result = await deliverChatLineNotification({
        ...payload,
        room_url: notification_urls.line_liff_url,
        line_user_id: receiver_state.contact.value,
      })

      if (result.delivered) {
        delivered_count += 1
      }

      continue
    }

    if (!receiver_state.contact) {
      continue
    }

    const result = await deliverChatPushNotification({
      ...payload,
      room_url: notification_urls.push_url,
      push_endpoint: receiver_state.contact.value,
    })

    if (result.delivered) {
      delivered_count += 1
    }
  }

  return { delivered_count }
}

export async function notifyEvent(input: NotifyEventInput) {
  if (input.request_id && hasNotifyBeenDelivered(input.request_id, input.event)) {
    await logNotifyDebug("notify_delivery_skipped", {
      reason: "duplicate_request",
      event: input.event,
      request_id: input.request_id ?? null,
    })
    return { delivered: false, reason: "duplicate_request" } satisfies NotifyEventResult
  }

  const delivery = resolveNotifyDelivery(input)

  if (delivery.channel === "discord" && !delivery.webhook_url) {
    await logNotifyDebug("notify_delivery_skipped", {
      reason: "webhook_missing",
      event: input.event,
      request_id: input.request_id ?? null,
      webhook: "NOTIFY_WOLF_WEBHOOK",
      payload: input.payload,
    })
    return { delivered: false, reason: "webhook_missing" } satisfies NotifyEventResult
  }

  if (input.request_id) {
    markNotifyDelivered(input.request_id, input.event)
  }

  try {
    let result: NotifyEventResult = { delivered: false }

    if (delivery.channel === "discord") {
      result = await deliverDiscordNotification(delivery)
    }

    if (delivery.channel === "odin") {
      const { deliverOdinNotification } = await import("@/core/notify/odin")
      result = await deliverOdinNotification(delivery)
    }

    await logNotifyDebug("notify_delivery_sent", {
      event: input.event,
      request_id: input.request_id ?? null,
      priority: delivery.priority,
      channel: delivery.channel,
      delivered: result.delivered,
      reason: result.reason ?? null,
      payload: input.payload,
    })

    return result
  } catch (error) {
    await logNotifyDebug("notify_delivery_failed", {
      event: input.event,
      request_id: input.request_id ?? null,
      error_message: error instanceof Error ? error.message : String(error),
      payload: input.payload,
    })

    return {
      delivered: false,
      reason: error instanceof Error ? error.message : String(error),
    } satisfies NotifyEventResult
  }
}

export async function notify(message: NotifyMessage) {
  if (message.channel === "discord") {
    await notifyDiscord(message)
  }
}

export type { NotifyEventInput, NotifyEventName } from "@/core/notify/rules"
