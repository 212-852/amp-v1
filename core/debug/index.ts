import {
  resolveDebugTitle,
  shouldSendAuthSessionDebug,
} from "@/core/debug/rules"
import { notify } from "@/core/notify"

export async function sendAuthDebug(
  event: string,
  payload: Record<string, unknown>,
  request_id?: string | null,
) {
  if (!shouldSendAuthSessionDebug(event)) {
    return
  }

  try {
    await notify({
      channel: "discord",
      title: resolveDebugTitle(event),
      event,
      request_id,
      payload,
    })
  } catch (error) {
    console.error("TEMP_AUTH_DEBUG_FAILED", error)
  }
}
