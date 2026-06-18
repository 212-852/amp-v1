import type { ContactRecord } from "@/core/contacts/rules"
import type { DeliveryResult } from "@/core/output"
import type { OutputMessage } from "@/core/output/rules"

export async function deliverLine(
  contact: ContactRecord,
  message: OutputMessage,
  options: { reply_token?: string | null } = {},
): Promise<DeliveryResult> {
  const token = process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN

  if (!token || (!contact.value && !options.reply_token)) {
    return { transport: "line", delivered: false }
  }

  const line_payloads =
    Array.isArray(message.line_messages) && message.line_messages.length > 0
      ? message.line_messages
      : [
          {
            type: "text",
            text: message.text,
          },
        ]

  const response = await fetch(
    options.reply_token
      ? "https://api.line.me/v2/bot/message/reply"
      : "https://api.line.me/v2/bot/message/push",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        options.reply_token
          ? {
              replyToken: options.reply_token,
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

  return { transport: "line", delivered: response.ok }
}
