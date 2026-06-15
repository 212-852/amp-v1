import type { DeliveryResult } from "@/core/output"
import type { OutputMessage } from "@/core/output/rules"
import type { AccessRecord } from "@/core/access/rules"

export async function deliverWeb(
  visitor: AccessRecord | null,
  message: OutputMessage,
): Promise<DeliveryResult> {
  void visitor
  void message

  return { transport: "web", delivered: false }
}
