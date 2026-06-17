import type { OutputMessage, OutputTarget } from "@/core/output/rules"
import { loadOutputContacts, resolveOutputDestinations } from "@/core/output/rules"
import { deliverDiscord } from "@/core/output/discord"
import { deliverLine } from "@/core/output/line"
import { deliverPush } from "@/core/output/push"
import { deliverWeb } from "@/core/output/web"

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
    return [await deliverWeb(null, message)]
  }

  const contacts = await loadOutputContacts(target)
  const destinations = resolveOutputDestinations(contacts, target)

  return Promise.all(
    destinations.map(async (destination) => {
      if (destination.transport === "line") {
        return destination.contact
          ? deliverLine(destination.contact, message)
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
