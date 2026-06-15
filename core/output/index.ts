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
  const contacts = await loadOutputContacts(target)
  const destinations = resolveOutputDestinations(contacts)

  return Promise.all(
    destinations.map(async (destination) => {
      if (destination.transport === "line") {
        return deliverLine(destination.contact, message)
      }

      if (destination.transport === "web") {
        return deliverWeb(destination.contact, message)
      }

      if (destination.transport === "push") {
        return deliverPush(destination.contact, message)
      }

      if (destination.transport === "discord") {
        return deliverDiscord(destination.contact, message)
      }

      return {
        transport: "none",
        delivered: false,
      }
    }),
  )
}
