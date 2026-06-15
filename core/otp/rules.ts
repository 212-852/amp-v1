import type { OtpContext } from "@/core/otp/context"

export type OtpRecord = {
  otp_uuid: string
  visitor_uuid: string | null
  user_uuid: string | null
  purpose: OtpContext["purpose"]
  channel: OtpContext["channel"]
  target: string
  code_hash: string
  expires_at: string
  consumed_at: string | null
  attempt_count: number
  max_attempt_count: number
  created_at: string
}

const resend_interval_ms = 60 * 1000

export function assert_can_issue_otp(latest: Pick<OtpRecord, "created_at"> | null) {
  if (!latest) {
    return
  }

  const elapsed = Date.now() - new Date(latest.created_at).getTime()

  if (elapsed < resend_interval_ms) {
    throw new Error("Please wait before requesting a new code")
  }
}

export function assert_can_verify_otp(record: OtpRecord | null) {
  if (!record) {
    throw new Error("OTP code was not found")
  }

  if (record.consumed_at) {
    throw new Error("OTP code was already used")
  }

  if (new Date(record.expires_at).getTime() <= Date.now()) {
    throw new Error("OTP code has expired")
  }

  if (record.attempt_count >= record.max_attempt_count) {
    throw new Error("OTP attempt limit exceeded")
  }
}
