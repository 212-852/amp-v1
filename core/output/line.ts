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
import type { OutputMessage } from "@/core/output/rules"
import { sendAuthDebug } from "@/core/debug"
import { consumeLineReplyToken } from "@/core/line/reply_token"

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

    return {
      ...record,
      action: normalized_action,
    }
  }

  if (record.type === "image" && typeof record.url === "string") {
    const normalized = resolve_line_image_url(record.url, context)

    if (!normalized.ok) {
      return null
    }

    return {
      ...record,
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

export async function deliverLine(
  contact: ContactRecord,
  message: OutputMessage,
  options: {
    reply_token?: string | null
    provider_user_id?: string | null
  } = {},
): Promise<DeliveryResult> {
  const token = process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN
  const provider_user_id = options.provider_user_id ?? contact.value
  const reply_token = consumeLineReplyToken(options.reply_token)

  if (options.reply_token && !reply_token) {
    return { transport: "line", delivered: false }
  }

  if (!token || (!contact.value && !reply_token)) {
    await sendAuthDebug("line_reply_send_failed", {
      provider_user_id,
      status: 0,
      error_message: !token ? "missing_access_token" : "missing_line_destination",
    })
    return { transport: "line", delivered: false }
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

  await sendAuthDebug("line_reply_send_attempt", {
    provider_user_id,
    reply_token_exists: Boolean(reply_token),
    message_count: line_payloads.length,
  })

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

    await sendAuthDebug("line_reply_send_failed", {
      provider_user_id,
      status: response.status,
      error_message,
    })

    return { transport: "line", delivered: false }
  }

  await sendAuthDebug("line_reply_send_success", {
    provider_user_id,
  })

  return { transport: "line", delivered: response.ok }
}
