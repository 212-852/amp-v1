import type { OutputMessage, OutputTarget } from "@/core/output/rules"
import { loadOutputContacts, resolveOutputDestinations } from "@/core/output/rules"
import { deliverDiscord } from "@/core/output/discord"
import { deliverLine } from "@/core/output/line"
import { deliverPush } from "@/core/output/push"
import { deliverWeb } from "@/core/output/web"
import { sendAuthDebug } from "@/core/debug"

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
        should_send: destination.transport !== "none" && Boolean(destination.contact),
      })

      if (destination.transport === "line") {
        return destination.contact
          ? deliverLine(destination.contact, message, {
              reply_token: target.line_reply_token,
              provider_user_id: target.line_provider_user_id,
            })
          : { transport: "line", delivered: false }
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
