import type { OutputMessage, OutputTarget } from "@/core/output/rules"
import {
  isLineWebhookReplyEnabled,
  is_web_source_channel,
  loadOutputContacts,
  resolveOutputDestinations,
  type OutputDestination,
} from "@/core/output/rules"
import {
  build_output_idempotency_key,
  claim_output_delivery,
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
    selected_action:
      message.selected_action ??
      (typeof message.data?.selected_action === "string"
        ? message.data.selected_action
        : null),
    destination: destination.transport,
  })
}

async function log_output_route(
  target: OutputTarget,
  destination: OutputDestination,
  message: OutputMessage,
  extra: Record<string, unknown> = {},
) {
  const reply_token_record = destination.reply_token_record ?? null

  await sendAuthDebug("output_route_resolved", {
    room_uuid: target.room_uuid ?? null,
    source_channel: target.channel ?? null,
    receiver_channel: destination.receiver_channel,
    destination: destination.transport,
    should_send: destination.should_send,
    reason: destination.reason,
    has_reply_token: Boolean(target.line_reply_token),
    reply_token_source: reply_token_record?.reply_token_source ?? null,
    reply_token_used: reply_token_record?.reply_token_used_at !== null,
    reply_token_fresh: is_line_reply_token_fresh(reply_token_record),
    line_send_method: destination.line_send_method ?? null,
    output_idempotency_key: resolve_output_idempotency_key(target, message, destination),
    duplicate_skipped: false,
    skipped_reason: null,
    retry_allowed: false,
    reply_token_exists: Boolean(target.line_reply_token),
    line_reply_allowed: target.line_reply_allowed === true,
    reply_enabled: isLineWebhookReplyEnabled(),
    ...extra,
  })
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
    const output_idempotency_key = resolve_output_idempotency_key(
      target,
      message,
      destination,
    )

    if (!claim_output_delivery(output_idempotency_key)) {
      await log_output_route(target, destination, message, {
        duplicate_skipped: true,
        skipped_reason: "output_idempotency_duplicate",
      })
      return [{ transport: "web", delivered: false, duplicate_skipped: true }]
    }

    await log_output_route(target, destination, message)
    return [await deliverWeb(null, message)]
  }

  const contacts = await loadOutputContacts(target)
  const destinations = resolveOutputDestinations(contacts, target)

  return Promise.all(
    destinations.map(async (destination) => {
      const output_idempotency_key = resolve_output_idempotency_key(
        target,
        message,
        destination,
      )

      if (!claim_output_delivery(output_idempotency_key)) {
        await log_output_route(target, destination, message, {
          duplicate_skipped: true,
          skipped_reason: "output_idempotency_duplicate",
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
        }
      }

      await log_output_route(target, destination, message)

      if (!destination.should_send) {
        if (
          destination.transport === "line_reply" ||
          destination.line_send_method === "reply"
        ) {
          await sendAuthDebug("line_reply_skipped", {
            room_uuid: target.room_uuid ?? null,
            source_channel: target.channel ?? null,
            receiver_channel: destination.receiver_channel,
            destination: destination.transport,
            has_reply_token: Boolean(target.line_reply_token),
            reply_token_source:
              destination.reply_token_record?.reply_token_source ?? null,
            reply_token_used:
              destination.reply_token_record?.reply_token_used_at !== null,
            reply_token_fresh: is_line_reply_token_fresh(
              destination.reply_token_record,
            ),
            line_send_method: destination.line_send_method ?? null,
            output_idempotency_key,
            duplicate_skipped: false,
            skipped_reason: destination.reason,
            retry_allowed: false,
          })
        }

        return {
          transport:
            destination.transport === "line_reply" ||
            destination.transport === "line_push"
              ? destination.transport
              : destination.transport,
          delivered: false,
          skipped_reason: destination.reason,
          failed_final: destination.line_send_method === "reply",
        }
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

        return deliverLine(contact, message, {
          destination,
          target,
          reply_token: destination.reply_token_record?.reply_token ?? null,
          provider_user_id: target.line_provider_user_id,
          output_idempotency_key,
        })
      }

      if (destination.transport === "web") {
        return deliverWeb(destination.contact, message)
      }

      if (destination.transport === "push") {
        return destination.contact
          ? deliverPush(destination.contact, message)
          : { transport: "push", delivered: false }
      }

      if (destination.transport === "discord") {
        return destination.contact
          ? deliverDiscord(destination.contact, message)
          : { transport: "discord", delivered: false }
      }

      return {
        transport: "none",
        delivered: false,
      }
    }),
  )
}
