import { createHmac, randomInt, timingSafeEqual } from "crypto"

import { sendIdentityDebug } from "@/core/auth/identity"
import { getRestConfig, readRestError, restHeaders, restUrl } from "@/core/db/rest"
import type { OtpContext } from "@/core/otp/context"
import { assert_can_issue_otp, assert_can_verify_otp, type OtpRecord } from "@/core/otp/rules"

const OTP_SELECT =
  "otp_uuid,visitor_uuid,user_uuid,purpose,channel,target,code_hash,expires_at,consumed_at,attempt_count,max_attempt_count,created_at"

function otp_secret() {
  const secret = process.env.OTP_SECRET

  if (!secret) {
    throw new Error("OTP_SECRET is required")
  }

  return secret
}

function otp_filter(context: OtpContext) {
  return [
    `purpose=eq.${encodeURIComponent(context.purpose)}`,
    `channel=eq.${encodeURIComponent(context.channel)}`,
    `target=eq.${encodeURIComponent(context.target)}`,
    `visitor_uuid=eq.${encodeURIComponent(context.visitor_uuid)}`,
  ].join("&")
}

function hash_code(context: OtpContext, code: string) {
  return createHmac("sha256", otp_secret())
    .update(
      [
        context.purpose,
        context.channel,
        context.target,
        context.visitor_uuid,
        code,
      ].join(":"),
    )
    .digest("hex")
}

function generate_code() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0")
}

function is_hash_match(expected: string, actual: string) {
  const expectedBuffer = Buffer.from(expected, "hex")
  const actualBuffer = Buffer.from(actual, "hex")

  return (
    expectedBuffer.length === actualBuffer.length &&
    timingSafeEqual(expectedBuffer, actualBuffer)
  )
}

async function latest_otp(context: OtpContext) {
  const config = getRestConfig()

  if (!config) {
    throw new Error("Database config is missing")
  }

  const response = await fetch(
    restUrl(
      config,
      "otp",
      [
        otp_filter(context),
        "consumed_at=is.null",
        `select=${OTP_SELECT}`,
        "order=created_at.desc",
        "limit=1",
      ].join("&"),
    ),
    {
      headers: restHeaders(config),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    const error = await readRestError(response)
    throw new Error(
      `Failed to load OTP: ${error.code ?? "unknown"} ${
        error.message ?? "No PostgREST error returned"
      }`,
    )
  }

  const rows = (await response.json()) as OtpRecord[]

  return rows[0] ?? null
}

async function expire_active_otps(context: OtpContext) {
  const config = getRestConfig()

  if (!config) {
    throw new Error("Database config is missing")
  }

  const now = new Date().toISOString()
  const response = await fetch(
    restUrl(
      config,
      "otp",
      [
        otp_filter(context),
        "consumed_at=is.null",
        `expires_at=gt.${encodeURIComponent(now)}`,
      ].join("&"),
    ),
    {
      method: "PATCH",
      headers: restHeaders(config),
      body: JSON.stringify({
        expires_at: now,
      }),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    const error = await readRestError(response)
    throw new Error(
      `Failed to expire OTP: ${error.code ?? "unknown"} ${
        error.message ?? "No PostgREST error returned"
      }`,
    )
  }
}

async function insert_otp(context: OtpContext, code: string) {
  const config = getRestConfig()

  if (!config) {
    throw new Error("Database config is missing")
  }

  const now = new Date()
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000).toISOString()
  const response = await fetch(
    restUrl(config, "otp", `select=${OTP_SELECT}`),
    {
      method: "POST",
      headers: {
        ...restHeaders(config),
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        visitor_uuid: context.visitor_uuid,
        user_uuid: context.user_uuid,
        purpose: context.purpose,
        channel: context.channel,
        target: context.target,
        code_hash: hash_code(context, code),
        expires_at: expiresAt,
        max_attempt_count: 5,
      }),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    const error = await readRestError(response)
    throw new Error(
      `Failed to insert OTP: ${error.code ?? "unknown"} ${
        error.message ?? "No PostgREST error returned"
      }`,
    )
  }

  const rows = (await response.json()) as OtpRecord[]

  return rows[0]
}

async function increment_attempt(record: OtpRecord) {
  const config = getRestConfig()

  if (!config) {
    throw new Error("Database config is missing")
  }

  const response = await fetch(
    restUrl(config, "otp", `otp_uuid=eq.${encodeURIComponent(record.otp_uuid)}`),
    {
      method: "PATCH",
      headers: restHeaders(config),
      body: JSON.stringify({
        attempt_count: record.attempt_count + 1,
      }),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    const error = await readRestError(response)
    throw new Error(
      `Failed to update OTP attempt: ${error.code ?? "unknown"} ${
        error.message ?? "No PostgREST error returned"
      }`,
    )
  }
}

async function consume_otp(record: OtpRecord) {
  const config = getRestConfig()

  if (!config) {
    throw new Error("Database config is missing")
  }

  const response = await fetch(
    restUrl(config, "otp", `otp_uuid=eq.${encodeURIComponent(record.otp_uuid)}`),
    {
      method: "PATCH",
      headers: restHeaders(config),
      body: JSON.stringify({
        consumed_at: new Date().toISOString(),
      }),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    const error = await readRestError(response)
    throw new Error(
      `Failed to consume OTP: ${error.code ?? "unknown"} ${
        error.message ?? "No PostgREST error returned"
      }`,
    )
  }
}

export async function issue_otp(context: OtpContext) {
  await sendIdentityDebug("otp_issue_start", {
    purpose: context.purpose,
    channel: context.channel,
    target: context.target,
    visitor_uuid: context.visitor_uuid,
    user_uuid: context.user_uuid,
  })

  const latest = await latest_otp(context)
  assert_can_issue_otp(latest)
  await expire_active_otps(context)

  const code = generate_code()
  const record = await insert_otp(context, code)

  await sendIdentityDebug("otp_issue_success", {
    purpose: context.purpose,
    channel: context.channel,
    target: context.target,
    visitor_uuid: context.visitor_uuid,
    user_uuid: context.user_uuid,
    otp_uuid: record?.otp_uuid ?? null,
    expires_at: record?.expires_at ?? null,
  })

  return {
    code,
    record,
  }
}

export async function verify_otp(context: OtpContext, code: string) {
  await sendIdentityDebug("otp_verify_start", {
    purpose: context.purpose,
    channel: context.channel,
    target: context.target,
    visitor_uuid: context.visitor_uuid,
    user_uuid: context.user_uuid,
  })

  const record = await latest_otp(context)

  try {
    assert_can_verify_otp(record)
  } catch (error) {
    await sendIdentityDebug("otp_verify_failed", {
      purpose: context.purpose,
      channel: context.channel,
      target: context.target,
      visitor_uuid: context.visitor_uuid,
      reason: error instanceof Error ? error.message : String(error),
    })
    throw error
  }

  const expected = hash_code(context, code)

  if (!is_hash_match(expected, record.code_hash)) {
    await increment_attempt(record)
    await sendIdentityDebug("otp_verify_failed", {
      purpose: context.purpose,
      channel: context.channel,
      target: context.target,
      visitor_uuid: context.visitor_uuid,
      reason: "code_mismatch",
      attempt_count: record.attempt_count + 1,
      max_attempt_count: record.max_attempt_count,
    })
    throw new Error("Invalid OTP code")
  }

  await consume_otp(record)
  await sendIdentityDebug("otp_verify_success", {
    purpose: context.purpose,
    channel: context.channel,
    target: context.target,
    visitor_uuid: context.visitor_uuid,
    user_uuid: context.user_uuid,
    otp_uuid: record.otp_uuid,
  })

  return record
}
