import type { OutputMessage, OutputTarget } from "@/core/output/rules"
import {
  isLineWebhookReplyEnabled,
  is_web_source_channel,
  loadOutputContacts,
  resolveOutputDestinations,
  type OutputDestination,
} from "@/core/output/rules"
import {
  begin_output_delivery,
  build_output_idempotency_key,
  build_output_semantic_source_key,
  complete_output_delivery,
  inspect_output_delivery_state,
  type OutputDeliveryState,
} from "@/core/output/idempotency"
import { deliverDiscord } from "@/core/output/discord"
import { deliverLine } from "@/core/output/line"
import { deliverPush } from "@/core/output/push"
import { deliverWeb } from "@/core/output/web"
import { sendAuthDebug } from "@/core/debug"
import type { ContactRecord } from "@/core/contacts/rules"
import { is_line_reply_token_fresh } from "@/core/line/reply_token"

export type DeliveryResult = {
  transport: "line_reply" | "line_push" | "line" | "web" | "push" | "discord" | "none"
  delivered: boolean
  failed_final?: boolean
  skipped_reason?: string | null
  duplicate_skipped?: boolean
  existing_output_state?: OutputDeliveryState | null
}

function resolve_output_idempotency_key(
  target: OutputTarget,
  message: OutputMessage,
  destination: OutputDestination,
) {
  return build_output_idempotency_key({
    room_uuid: target.room_uuid ?? "unknown",
    source_message_uuid:
      message.source_message_uuid ??
      (typeof message.data?.source_message_uuid === "string"
        ? message.data.source_message_uuid
        : "unknown"),
    source_event_uuid:
      message.source_event_uuid ??
      (typeof message.data?.source_event_uuid === "string"
        ? message.data.source_event_uuid
        : null),
    normalized_text:
      message.normalized_text ??
      (typeof message.data?.normalized_text === "string"
        ? message.data.normalized_text
        : message.text.trim().toLowerCase()),
    selected_action:
      message.selected_action ??
      (typeof message.data?.selected_action === "string"
        ? message.data.selected_action
        : null),
    destination: destination.transport,
  })
}

function resolve_output_semantic_source_key(message: OutputMessage) {
  return build_output_semantic_source_key({
    source_message_uuid:
      message.source_message_uuid ??
      (typeof message.data?.source_message_uuid === "string"
        ? message.data.source_message_uuid
        : "unknown"),
    source_event_uuid:
      message.source_event_uuid ??
      (typeof message.data?.source_event_uuid === "string"
        ? message.data.source_event_uuid
        : null),
    normalized_text:
      message.normalized_text ??
      (typeof message.data?.normalized_text === "string"
        ? message.data.normalized_text
        : message.text.trim().toLowerCase()),
  })
}

function resolve_reply_token_debug(
  target: OutputTarget,
  destination: OutputDestination,
) {
  const reply_token_record = destination.reply_token_record ?? null

  return {
    has_reply_token: Boolean(target.line_reply_token),
    reply_token_source: reply_token_record?.reply_token_source ?? null,
    reply_token_used: reply_token_record?.reply_token_used_at !== null,
    reply_token_fresh: is_line_reply_token_fresh(reply_token_record),
  }
}

async function log_output_route(
  target: OutputTarget,
  destination: OutputDestination,
  message: OutputMessage,
  extra: Record<string, unknown> = {},
) {
  const output_idempotency_key = resolve_output_idempotency_key(
    target,
    message,
    destination,
  )
  const existing_output_state = inspect_output_delivery_state(output_idempotency_key)
  const semantic_source_key = resolve_output_semantic_source_key(message)

  await sendAuthDebug("output_route_resolved", {
    room_uuid: target.room_uuid ?? null,
    source_channel: target.channel ?? null,
    receiver_channel: destination.receiver_channel,
    destination: destination.transport,
    should_send: destination.should_send,
    reason: destination.reason,
    ...resolve_reply_token_debug(target, destination),
    line_send_method: destination.line_send_method ?? null,
    output_idempotency_key,
    semantic_source_key,
    existing_output_state,
    duplicate_skipped: false,
    skipped_reason: null,
    retry_allowed: false,
    reply_token_exists: Boolean(target.line_reply_token),
    line_reply_allowed: target.line_reply_allowed === true,
    reply_enabled: isLineWebhookReplyEnabled(),
    ...extra,
  })
}

async function skip_duplicate_output(
  target: OutputTarget,
  destination: OutputDestination,
  message: OutputMessage,
  output_idempotency_key: string,
  existing_output_state: OutputDeliveryState,
) {
  await log_output_route(target, destination, message, {
    duplicate_skipped: true,
    skipped_reason: "output_idempotency_duplicate",
    existing_output_state,
  })

  return {
    transport:
      destination.transport === "line_reply" ||
      destination.transport === "line_push"
        ? destination.transport
        : destination.transport,
    delivered: false,
    duplicate_skipped: true,
    skipped_reason: "output_idempotency_duplicate",
    existing_output_state,
  } satisfies DeliveryResult
}

async function deliver_destination(
  target: OutputTarget,
  message: OutputMessage,
  destination: OutputDestination,
) {
  const output_idempotency_key = resolve_output_idempotency_key(
    target,
    message,
    destination,
  )
  const begin = begin_output_delivery(output_idempotency_key)

  if (!begin.ok) {
    return skip_duplicate_output(
      target,
      destination,
      message,
      output_idempotency_key,
      begin.existing_state,
    )
  }

  await log_output_route(target, destination, message, {
    existing_output_state: begin.state,
  })

  if (!destination.should_send) {
    const skipped_reason = destination.reason

    if (
      destination.transport === "line_reply" ||
      destination.line_send_method === "reply"
    ) {
      await sendAuthDebug("line_reply_skipped", {
        room_uuid: target.room_uuid ?? null,
        source_channel: target.channel ?? null,
        receiver_channel: destination.receiver_channel,
        destination: destination.transport,
        ...resolve_reply_token_debug(target, destination),
        line_send_method: destination.line_send_method ?? null,
        output_idempotency_key,
        semantic_source_key: resolve_output_semantic_source_key(message),
        existing_output_state: begin.state,
        duplicate_skipped: false,
        skipped_reason,
        retry_allowed: false,
      })
    }

    complete_output_delivery(output_idempotency_key, "skipped")

    return {
      transport:
        destination.transport === "line_reply" ||
        destination.transport === "line_push"
          ? destination.transport
          : destination.transport,
      delivered: false,
      skipped_reason,
      failed_final: destination.line_send_method === "reply",
      existing_output_state: "skipped",
    } satisfies DeliveryResult
  }

  if (
    destination.transport === "line_reply" ||
    destination.transport === "line_push"
  ) {
    const contact =
      destination.contact ??
      ({
        user_uuid: target.user_uuid ?? null,
        visitor_uuid: target.visitor_uuid ?? null,
        type: "line",
        value: target.line_provider_user_id ?? "",
        channel: "line",
        state: "active",
        receive: true,
        last_seen_at: null,
      } satisfies ContactRecord)

    const result = await deliverLine(contact, message, {
      destination,
      target,
      reply_token: destination.reply_token_record?.reply_token ?? null,
      provider_user_id: target.line_provider_user_id,
      output_idempotency_key,
    })

    if (result.delivered) {
      complete_output_delivery(output_idempotency_key, "sent")
    } else if (result.failed_final) {
      complete_output_delivery(output_idempotency_key, "failed_final")
    } else if (result.skipped_reason) {
      complete_output_delivery(output_idempotency_key, "skipped")
    } else {
      complete_output_delivery(output_idempotency_key, "failed_final")
    }

    return {
      ...result,
      existing_output_state: (result.delivered
        ? "sent"
        : result.failed_final
          ? "failed_final"
          : "skipped") as OutputDeliveryState,
    }
  }

  if (destination.transport === "web") {
    const result = await deliverWeb(destination.contact, message)
    complete_output_delivery(
      output_idempotency_key,
      result.delivered ? "sent" : "failed_final",
    )
    return result
  }

  if (destination.transport === "push") {
    const result = destination.contact
      ? await deliverPush(destination.contact, message)
      : { transport: "push" as const, delivered: false }
    complete_output_delivery(
      output_idempotency_key,
      result.delivered ? "sent" : "skipped",
    )
    return result
  }

  if (destination.transport === "discord") {
    const result = destination.contact
      ? await deliverDiscord(destination.contact, message)
      : { transport: "discord" as const, delivered: false }
    complete_output_delivery(
      output_idempotency_key,
      result.delivered ? "sent" : "skipped",
    )
    return result
  }

  complete_output_delivery(output_idempotency_key, "skipped")

  return {
    transport: "none",
    delivered: false,
    skipped_reason: destination.reason,
    existing_output_state: "skipped",
  } satisfies DeliveryResult
}

export async function deliverOutput(
  target: OutputTarget,
  message: OutputMessage,
): Promise<DeliveryResult[]> {
  if (is_web_source_channel(target.channel)) {
    const destination: OutputDestination = {
      contact: null,
      transport: "web",
      should_send: true,
      reason: "web_channel",
      receiver_channel: target.channel ?? "web",
      line_send_method: null,
      reply_token_record: null,
    }

    return [await deliver_destination(target, message, destination)]
  }

  const contacts = await loadOutputContacts(target)
  const destinations = resolveOutputDestinations(contacts, target)

  return Promise.all(
    destinations.map((destination) =>
      deliver_destination(target, message, destination),
    ),
  )
}
