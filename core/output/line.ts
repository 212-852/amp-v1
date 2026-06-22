import {
  carouselPayloadToLineFlex,
  isLineFlexCarouselPayload,
  type LineFlexCarouselPayload,
} from "@/core/bot/rules"
import type { ContactRecord } from "@/core/contacts/rules"
import type { DeliveryResult } from "@/core/output"
import {
  normalize_line_uri,
  resolve_public_app_url,
  type LineUriNormalizeResult,
} from "@/core/output/uri"
import type { OutputDestination, OutputMessage, OutputTarget } from "@/core/output/rules"
import {
  apply_line_card_button,
  apply_line_card_hero,
  should_apply_card_hero_fit,
} from "@/core/output/rules"
import { sendAuthDebug } from "@/core/debug"
import {
  claim_line_reply_token_for_send,
  is_line_reply_token_fresh,
  LINE_REPLY_TOKEN_SOURCE,
  mark_line_reply_token_used,
  read_line_reply_token_record,
  validate_line_webhook_reply_token,
} from "@/core/line/reply_token"

type LineFlexNormalizeContext = {
  room_uuid?: string | null
  message_bundle_type?: string | null
  base_url?: string | null
}

function read_record(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }

  return value as Record<string, unknown>
}

function read_contents(value: unknown) {
  return Array.isArray(value) ? value : []
}

function log_line_flex_uri_event(
  event: "line_flex_uri_normalized" | "line_flex_uri_rejected",
  input: {
    original_uri: string
    normalized_uri?: string | null
    reason: string
    message_bundle_type?: string | null
    action_type?: string | null
    room_uuid?: string | null
  },
) {
  void sendAuthDebug(event, {
    original_uri: input.original_uri,
    normalized_uri: input.normalized_uri ?? null,
    reason: input.reason,
    message_bundle_type: input.message_bundle_type ?? null,
    action_type: input.action_type ?? null,
    room_uuid: input.room_uuid ?? null,
  })
}

function resolve_line_image_url(
  value: string,
  context: LineFlexNormalizeContext,
): LineUriNormalizeResult {
  if (/^https:\/\//i.test(value)) {
    return {
      ok: true,
      uri: value,
      reason: "absolute_https",
    }
  }

  const normalized = normalize_line_uri(value)

  if (normalized.ok) {
    log_line_flex_uri_event("line_flex_uri_normalized", {
      original_uri: value,
      normalized_uri: normalized.uri,
      reason: normalized.reason,
      message_bundle_type: context.message_bundle_type ?? null,
      action_type: "image",
      room_uuid: context.room_uuid ?? null,
    })
  } else {
    log_line_flex_uri_event("line_flex_uri_rejected", {
      original_uri: value,
      reason: normalized.reason,
      message_bundle_type: context.message_bundle_type ?? null,
      action_type: "image",
      room_uuid: context.room_uuid ?? null,
    })
  }

  return normalized
}

function normalize_line_flex_action(
  action: Record<string, unknown>,
  context: LineFlexNormalizeContext,
) {
  const action_type =
    typeof action.type === "string" ? action.type.trim() : ""

  if (action_type !== "uri") {
    return action
  }

  const original_uri =
    typeof action.uri === "string" ? action.uri : String(action.uri ?? "")

  const normalized = normalize_line_uri(action.uri)

  if (!normalized.ok) {
    log_line_flex_uri_event("line_flex_uri_rejected", {
      original_uri,
      reason: normalized.reason,
      message_bundle_type: context.message_bundle_type ?? null,
      action_type,
      room_uuid: context.room_uuid ?? null,
    })
    return null
  }

  log_line_flex_uri_event("line_flex_uri_normalized", {
    original_uri,
    normalized_uri: normalized.uri,
    reason: normalized.reason,
    message_bundle_type: context.message_bundle_type ?? null,
    action_type,
    room_uuid: context.room_uuid ?? null,
  })

  return {
    ...action,
    uri: normalized.uri,
  }
}

function normalize_line_flex_node(
  value: unknown,
  context: LineFlexNormalizeContext,
): unknown | null {
  if (Array.isArray(value)) {
    return value
      .map((item) => normalize_line_flex_node(item, context))
      .filter((item) => item !== null)
  }

  const record = read_record(value)

  if (!record) {
    return value
  }

  if (record.type === "button") {
    const action = read_record(record.action)

    if (!action) {
      return null
    }

    const normalized_action = normalize_line_flex_action(action, context)

    if (!normalized_action) {
      return null
    }

    return apply_line_card_button({
      ...record,
      action: normalized_action,
    })
  }

  if (record.type === "image" && typeof record.url === "string") {
    const styled_image = should_apply_card_hero_fit(record)
      ? apply_line_card_hero(record)
      : record
    const normalized = resolve_line_image_url(
      typeof styled_image.url === "string" ? styled_image.url : record.url,
      context,
    )

    if (!normalized.ok) {
      return null
    }

    return {
      ...styled_image,
      url: normalized.uri,
    }
  }

  const next: Record<string, unknown> = {}

  for (const [key, child] of Object.entries(record)) {
    if (key === "contents") {
      const normalized_contents = read_contents(child)
        .map((item) => normalize_line_flex_node(item, context))
        .filter((item) => item !== null)

      if (normalized_contents.length === 0) {
        continue
      }

      next[key] = normalized_contents
      continue
    }

    if (key === "footer" || key === "header" || key === "body" || key === "hero") {
      const normalized_child = normalize_line_flex_node(child, context)

      if (normalized_child === null) {
        continue
      }

      const child_record = read_record(normalized_child)
      const child_contents = read_contents(child_record?.contents)

      if (
        child_record?.type === "box" &&
        child_contents.length === 0
      ) {
        continue
      }

      next[key] = normalized_child
      continue
    }

    next[key] = normalize_line_flex_node(child, context)
  }

  if (record.type === "box" && read_contents(next.contents).length === 0) {
    return null
  }

  return next
}

export function normalize_line_flex_payload(
  payload: LineFlexCarouselPayload,
  context: LineFlexNormalizeContext = {},
): LineFlexCarouselPayload {
  return {
    type: "carousel",
    contents: payload.contents
      .map((bubble) => normalize_line_flex_node(bubble, context))
      .filter((bubble): bubble is Record<string, unknown> => bubble !== null),
  }
}

export function build_line_messages_from_payload(input: {
  payload: Record<string, unknown> | null | undefined
  alt_text: string
  base_url?: string | null
  room_uuid?: string | null
  message_bundle_type?: string | null
}): unknown[] | undefined {
  if (!isLineFlexCarouselPayload(input.payload)) {
    return undefined
  }

  const base_url = input.base_url ?? resolve_public_app_url()
  const normalized_payload = normalize_line_flex_payload(input.payload, {
    room_uuid: input.room_uuid ?? null,
    message_bundle_type: input.message_bundle_type ?? null,
    base_url,
  })

  return [
    carouselPayloadToLineFlex({
      payload: normalized_payload,
      alt_text: input.alt_text,
      base_url,
    }),
  ]
}

function read_output_message_context(message: OutputMessage) {
  const data = read_record(message.data)
  const meta = read_record(data?.meta)

  return {
    room_uuid: typeof meta?.room_uuid === "string" ? meta.room_uuid : null,
    message_bundle_type:
      typeof data?.body === "string"
        ? data.body
        : typeof meta?.message_bundle_type === "string"
          ? meta.message_bundle_type
          : null,
  }
}

export function build_line_messages_from_output(
  message: OutputMessage,
  alt_text: string,
  base_url?: string | null,
) {
  if (Array.isArray(message.line_messages) && message.line_messages.length > 0) {
    return message.line_messages
  }

  const context = read_output_message_context(message)

  return build_line_messages_from_payload({
    payload: message.data ?? null,
    alt_text,
    base_url: base_url ?? resolve_public_app_url(),
    room_uuid: context.room_uuid,
    message_bundle_type: context.message_bundle_type,
  })
}

export { isLineFlexCarouselPayload, type LineFlexCarouselPayload }

function resolve_live_reply_token_state(input: {
  reply_token?: string | null
  destination_record?: OutputDestination["reply_token_record"]
}) {
  const record =
    read_line_reply_token_record(input.reply_token) ??
    input.destination_record ??
    null
  const reply_token_used = record?.reply_token_used_at !== null
  const reply_token_fresh = reply_token_used
    ? false
    : is_line_reply_token_fresh(record)

  return {
    record,
    reply_token_used,
    reply_token_fresh,
  }
}

function build_line_reply_debug_fields(
  options: {
    destination: OutputDestination
    target: OutputTarget
    reply_token?: string | null
    line_send_method: string
    output_idempotency_key?: string | null
  },
  extra: Record<string, unknown> = {},
) {
  const live_state = resolve_live_reply_token_state({
    reply_token: options.reply_token,
    destination_record: options.destination.reply_token_record,
  })

  return {
    room_uuid: options.target.room_uuid ?? null,
    source_channel: options.target.channel ?? null,
    receiver_channel: "line",
    destination: options.destination.transport,
    has_reply_token: Boolean(options.reply_token),
    reply_token_source: live_state.record?.reply_token_source ?? null,
    reply_token_used: live_state.reply_token_used,
    reply_token_fresh: live_state.reply_token_fresh,
    line_send_method: options.line_send_method,
    output_idempotency_key: options.output_idempotency_key ?? null,
    duplicate_skipped: false,
    retry_allowed: false,
    ...extra,
  }
}

export async function deliverLine(
  contact: ContactRecord,
  message: OutputMessage,
  options: {
    destination: OutputDestination
    target: OutputTarget
    reply_token?: string | null
    provider_user_id?: string | null
    output_idempotency_key?: string | null
  },
): Promise<DeliveryResult> {
  const token = process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN
  const provider_user_id = options.provider_user_id ?? contact.value
  const line_send_method = options.destination.line_send_method ?? "push"
  const use_reply = line_send_method === "reply"
  const debug_base = {
    destination: options.destination,
    target: options.target,
    reply_token: options.reply_token,
    line_send_method,
    output_idempotency_key: options.output_idempotency_key ?? null,
  }
  const live_state = resolve_live_reply_token_state({
    reply_token: options.reply_token,
    destination_record: options.destination.reply_token_record,
  })

  if (use_reply) {
    if (options.target.channel !== "line") {
      await sendAuthDebug("line_reply_skipped", build_line_reply_debug_fields(debug_base, {
        provider_user_id,
        skipped_reason: "source_channel_not_line",
      }))
      return {
        transport: "line_reply",
        delivered: false,
        failed_final: true,
        skipped_reason: "source_channel_not_line",
      }
    }

    if (options.destination.transport !== "line_reply") {
      await sendAuthDebug("line_reply_skipped", build_line_reply_debug_fields(debug_base, {
        provider_user_id,
        skipped_reason: "destination_not_line_reply",
      }))
      return {
        transport: "line_reply",
        delivered: false,
        failed_final: true,
        skipped_reason: "destination_not_line_reply",
      }
    }

    if (!options.reply_token?.trim()) {
      await sendAuthDebug("line_reply_skipped", build_line_reply_debug_fields(debug_base, {
        provider_user_id,
        skipped_reason: "reply_token_missing",
      }))
      return {
        transport: "line_reply",
        delivered: false,
        failed_final: true,
        skipped_reason: "reply_token_missing",
      }
    }

    if (live_state.reply_token_used) {
      await sendAuthDebug("line_reply_skipped", build_line_reply_debug_fields(debug_base, {
        provider_user_id,
        skipped_reason: "reply_token_already_used",
        reply_token_used: true,
        reply_token_fresh: false,
      }))
      return {
        transport: "line_reply",
        delivered: false,
        failed_final: true,
        skipped_reason: "reply_token_already_used",
      }
    }

    if (
      !live_state.record ||
      live_state.record.reply_token_source !== LINE_REPLY_TOKEN_SOURCE
    ) {
      await sendAuthDebug("line_reply_skipped", build_line_reply_debug_fields(debug_base, {
        provider_user_id,
        skipped_reason: "reply_token_invalid_source",
      }))
      return {
        transport: "line_reply",
        delivered: false,
        failed_final: true,
        skipped_reason: "reply_token_invalid_source",
      }
    }

    if (!live_state.reply_token_fresh) {
      await sendAuthDebug("line_reply_skipped", build_line_reply_debug_fields(debug_base, {
        provider_user_id,
        skipped_reason: "reply_token_not_fresh",
      }))
      return {
        transport: "line_reply",
        delivered: false,
        failed_final: true,
        skipped_reason: "reply_token_not_fresh",
      }
    }
  }

  const reply_validation = use_reply
    ? validate_line_webhook_reply_token(options.reply_token)
    : { ok: false as const, reason: "missing" as const }

  if (use_reply && !reply_validation.ok) {
    await sendAuthDebug("line_reply_skipped", build_line_reply_debug_fields(debug_base, {
      provider_user_id,
      skipped_reason: `reply_token_${reply_validation.reason}`,
    }))
    return {
      transport: "line_reply",
      delivered: false,
      failed_final: true,
      skipped_reason: `reply_token_${reply_validation.reason}`,
    }
  }

  const reply_token = reply_validation.ok
    ? reply_validation.record.reply_token
    : null

  if (!token || (!contact.value && !reply_token)) {
    await sendAuthDebug("line_reply_send_failed", build_line_reply_debug_fields(debug_base, {
      provider_user_id,
      status: 0,
      error_message: !token ? "missing_access_token" : "missing_line_destination",
    }))
    return {
      transport: use_reply ? "line_reply" : "line_push",
      delivered: false,
      failed_final: use_reply,
      skipped_reason: !token ? "missing_access_token" : "missing_line_destination",
    }
  }

  const line_payloads =
    build_line_messages_from_output(
      message,
      message.text,
      resolve_public_app_url(),
    ) ??
    [
      {
        type: "text",
        text: message.text,
      },
    ]

  if (use_reply && reply_token && reply_validation.ok) {
    await sendAuthDebug("line_reply_send_attempt", build_line_reply_debug_fields(debug_base, {
      provider_user_id,
      reply_token_exists: true,
      message_count: line_payloads.length,
      reply_token_used: false,
      reply_token_fresh: is_line_reply_token_fresh(reply_validation.record),
    }))

    const claim = claim_line_reply_token_for_send(reply_token)

    if (!claim.ok) {
      await sendAuthDebug("line_reply_skipped", build_line_reply_debug_fields(debug_base, {
        provider_user_id,
        skipped_reason: `reply_token_${claim.reason}`,
      }))
      return {
        transport: "line_reply",
        delivered: false,
        failed_final: true,
        skipped_reason: `reply_token_${claim.reason}`,
      }
    }
  } else {
    await sendAuthDebug("line_reply_send_attempt", build_line_reply_debug_fields(debug_base, {
      provider_user_id,
      reply_token_exists: Boolean(reply_token),
      message_count: line_payloads.length,
      reply_token_used: false,
      reply_token_fresh: false,
    }))
  }

  const response = await fetch(
    reply_token
      ? "https://api.line.me/v2/bot/message/reply"
      : "https://api.line.me/v2/bot/message/push",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        reply_token
          ? {
              replyToken: reply_token,
              messages: line_payloads,
            }
          : {
              to: contact.value,
              messages: line_payloads,
            },
      ),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    const error_message = await response.text().catch(() => "")
    const invalid_reply_token =
      use_reply &&
      reply_token &&
      (response.status === 400 ||
        /invalid reply token/i.test(error_message))

    if (invalid_reply_token && reply_token) {
      mark_line_reply_token_used(reply_token)
    }

    await sendAuthDebug("line_reply_send_failed", build_line_reply_debug_fields(debug_base, {
      provider_user_id,
      status: response.status,
      error_message,
      reply_token_used: invalid_reply_token,
      skipped_reason: invalid_reply_token ? "invalid_reply_token" : null,
    }))

    return {
      transport: use_reply ? "line_reply" : "line_push",
      delivered: false,
      failed_final: use_reply,
      skipped_reason: invalid_reply_token ? "invalid_reply_token" : `http_${response.status}`,
    }
  }

  await sendAuthDebug("line_reply_send_success", build_line_reply_debug_fields(debug_base, {
    provider_user_id,
    reply_token_used: Boolean(reply_token),
  }))

  return {
    transport: use_reply ? "line_reply" : "line_push",
    delivered: response.ok,
  }
}
