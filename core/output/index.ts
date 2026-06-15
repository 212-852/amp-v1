import type { OutputMessage, OutputTarget } from "@/core/output/rules"
import {
  loadOutputContacts,
  loadOutputVisitor,
  resolveOutputDestinations,
} from "@/core/output/rules"
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
  const [visitor, contacts] = await Promise.all([
    loadOutputVisitor(target),
    loadOutputContacts(target),
  ])
  const destinations = resolveOutputDestinations(visitor, contacts)

  return Promise.all(
    destinations.map(async (destination) => {
      if (destination.transport === "line") {
        return destination.contact
          ? deliverLine(destination.contact, message)
          : { transport: "line", delivered: false }
      }

      if (destination.transport === "web") {
        return deliverWeb(destination.visitor, message)
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
