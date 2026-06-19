import {
  resolveDebugTitle,
  shouldSendAuthSessionDebug,
} from "@/core/debug/rules"

export async function sendAuthDebug(
  event: string,
  payload: Record<string, unknown>,
  request_id?: string | null,
) {
  if (!shouldSendAuthSessionDebug(event)) {
    return
  }

  try {
    const { notify } = await import("@/core/notify")
    await notify({
      channel: "discord",
      title: resolveDebugTitle(event),
      event,
      request_id,
      payload,
    })
  } catch {
    // Debug delivery is best-effort and must stay server-only.
  }
}
