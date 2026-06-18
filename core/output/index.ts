import type { OutputMessage, OutputTarget } from "@/core/output/rules"
import {
  isLineWebhookReplyEnabled,
  loadOutputContacts,
  resolveOutputDestinations,
} from "@/core/output/rules"
import { deliverDiscord } from "@/core/output/discord"
import { deliverLine } from "@/core/output/line"
import { deliverPush } from "@/core/output/push"
import { deliverWeb } from "@/core/output/web"
import { sendAuthDebug } from "@/core/debug"
import type { ContactRecord } from "@/core/contacts/rules"

export type DeliveryResult = {
  transport: "line" | "web" | "push" | "discord" | "none"
  delivered: boolean
}

export async function deliverOutput(
  target: OutputTarget,
  message: OutputMessage,
): Promise<DeliveryResult[]> {
  if (
    target.channel === "web" ||
    target.channel === "pwa" ||
    target.channel === "liff"
  ) {
    await sendAuthDebug("output_route_resolved", {
      destination: "web",
      channel: target.channel,
      should_send: true,
      reason: "web_channel",
      reply_token_exists: Boolean(target.line_reply_token),
      line_reply_allowed: target.line_reply_allowed === true,
      reply_enabled: isLineWebhookReplyEnabled(),
      provider_user_id: target.line_provider_user_id ?? null,
    })
    return [await deliverWeb(null, message)]
  }

  const contacts = await loadOutputContacts(target)
  const destinations = resolveOutputDestinations(contacts, target)

  return Promise.all(
    destinations.map(async (destination) => {
      await sendAuthDebug("output_route_resolved", {
        destination: destination.transport,
        channel: target.channel ?? null,
        should_send: destination.should_send,
        reason: destination.reason,
        reply_token_exists: Boolean(target.line_reply_token),
        line_reply_allowed: target.line_reply_allowed === true,
        reply_enabled: isLineWebhookReplyEnabled(),
        provider_user_id: target.line_provider_user_id ?? null,
      })

      if (!destination.should_send) {
        return {
          transport: destination.transport,
          delivered: false,
        }
      }

      if (destination.transport === "line") {
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
          reply_token: target.line_reply_token,
          provider_user_id: target.line_provider_user_id,
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
