export async function sendNotifyDebug(
  event: string,
  payload: Record<string, unknown>,
  request_id?: string | null,
) {
  try {
    const { sendAuthDebug } = await import("@/core/debug")
    await sendAuthDebug(event, payload, request_id ?? null)
  } catch {
    // Server debug only.
  }
}
