import type { ContactRecord } from "@/core/contacts/rules"
import type { DeliveryResult } from "@/core/output"
import type { OutputMessage } from "@/core/output/rules"

export async function deliverLine(
  contact: ContactRecord,
  message: OutputMessage,
): Promise<DeliveryResult> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN

  if (!token || !contact.value) {
    return { transport: "line", delivered: false }
  }

  const response = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: contact.value,
      messages: [
        {
          type: "text",
          text: message.text,
        },
      ],
    }),
    cache: "no-store",
  })

  return { transport: "line", delivered: response.ok }
}
