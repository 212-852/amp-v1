import type { ContactRecord } from "@/core/contacts/rules"
import type { DeliveryResult } from "@/core/output"
import type { OutputMessage } from "@/core/output/rules"

export async function deliverWeb(
  contact: ContactRecord | null,
  message: OutputMessage,
): Promise<DeliveryResult> {
  void contact
  void message

  return { transport: "web", delivered: false }
}
