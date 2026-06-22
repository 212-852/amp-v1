import {
  carouselPayloadToLineFlex,
  isLineFlexCarouselPayload,
  type LineFlexCarouselPayload,
} from "@/core/bot/rules"
import type { ContactRecord } from "@/core/contacts/rules"
import type { DeliveryResult } from "@/core/output"
import type { OutputMessage } from "@/core/output/rules"
import { sendAuthDebug } from "@/core/debug"
import { consumeLineReplyToken } from "@/core/line/reply_token"

export function build_line_messages_from_payload(input: {
  payload: Record<string, unknown> | null | undefined
  alt_text: string
  base_url?: string | null
}): unknown[] | undefined {
  if (!isLineFlexCarouselPayload(input.payload)) {
    return undefined
  }

  return [
    carouselPayloadToLineFlex({
      payload: input.payload,
      alt_text: input.alt_text,
      base_url: input.base_url,
    }),
  ]
}

export function build_line_messages_from_output(
  message: OutputMessage,
  alt_text: string,
  base_url?: string | null,
) {
  if (Array.isArray(message.line_messages) && message.line_messages.length > 0) {
    return message.line_messages
  }

  return build_line_messages_from_payload({
    payload: message.data ?? null,
    alt_text,
    base_url,
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
    build_line_messages_from_output(message, message.text) ??
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
