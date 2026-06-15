import type { AppSession } from "@/core/auth/session"

export type OtpPurpose = "login"
export type OtpChannel = "email"

export type OtpContext = {
  visitor_uuid: string
  user_uuid: string | null
  purpose: OtpPurpose
  channel: OtpChannel
  target: string
}

function normalize_string(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

export function normalize_otp_target(channel: OtpChannel, value: unknown) {
  const normalized = normalize_string(value)

  if (!normalized) {
    return null
  }

  if (channel === "email") {
    return normalized.toLowerCase()
  }

  return normalized
}

export function normalize_otp_channel(value: unknown): OtpChannel {
  if (value === "email" || !value) {
    return "email"
  }

  throw new Error("Unsupported OTP channel")
}

export function normalize_otp_purpose(value: unknown): OtpPurpose {
  if (value === "login" || !value) {
    return "login"
  }

  throw new Error("Unsupported OTP purpose")
}

export function normalize_otp_context(input: {
  session: AppSession
  target: unknown
  purpose?: unknown
  channel?: unknown
}): OtpContext {
  const channel = normalize_otp_channel(input.channel)
  const target = normalize_otp_target(channel, input.target)

  if (!input.session.visitor_uuid) {
    throw new Error("OTP requires visitor_uuid")
  }

  if (!target) {
    throw new Error("OTP target is required")
  }

  return {
    visitor_uuid: input.session.visitor_uuid,
    user_uuid: input.session.user_uuid,
    purpose: normalize_otp_purpose(input.purpose),
    channel,
    target,
  }
}

export function normalize_otp_code(value: unknown) {
  const code = String(value ?? "")
    .trim()
    .replace(/\s+/g, "")

  if (!/^\d{6}$/.test(code)) {
    return null
  }

  return code
}
