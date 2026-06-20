export const AUTH_SESSION_DEBUG = process.env.AUTH_SESSION_DEBUG === "true"
export const DEBUG_LINE_WEBHOOK = process.env.DEBUG_LINE_WEBHOOK === "true"
export const DEBUG_CHAT_FLOW = process.env.DEBUG_CHAT_FLOW === "true"
export const DEBUG_ADMIN_ACCESS = process.env.DEBUG_ADMIN_ACCESS === "true"
export const DEBUG_NOTIFY = process.env.DEBUG_NOTIFY === "true"
// Temporary receiver-side realtime tracing. Flip default to false after fix.
export const CHAT_REALTIME_DEBUG =
  process.env.CHAT_REALTIME_DEBUG !== "false" &&
  process.env.chat_realtime_debug !== "false"
export const chat_realtime_debug = CHAT_REALTIME_DEBUG
