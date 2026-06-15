import type { ContactRecord } from "@/core/contacts/rules"
import type { DeliveryResult } from "@/core/output"
import type { OutputMessage } from "@/core/output/rules"

export async function deliverPush(
  contact: ContactRecord,
  message: OutputMessage,
): Promise<DeliveryResult> {
  void contact
  void message

  return { transport: "push", delivered: false }
}
