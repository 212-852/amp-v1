import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { sendIdentityDebug } from "@/core/auth/identity"
import {
  create_service_role_supabase_client,
  get_shared_auth_supabase_client,
} from "@/core/auth/supabase"

function normalizeEmail(value: unknown) {
  return typeof value === "string" && value.trim()
    ? value.trim().toLowerCase()
    : null
}

function normalizeCode(value: unknown) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, "")
}

function serializeError(error: unknown) {
  if (!error || typeof error !== "object") {
    return error
  }

  const record = error as Record<string, unknown>

  return {
    name: record.name ?? null,
    message: record.message ?? null,
    status: record.status ?? null,
    code: record.code ?? null,
    details: record.details ?? null,
    hint: record.hint ?? null,
  }
}

async function readRequestBody(request: NextRequest) {
  return (await request.json().catch(() => ({}))) as Record<string, unknown>
}

async function findAuthUserByEmail(email: string) {
  const admin = create_service_role_supabase_client()
  const result = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  })
  const user = result.data.users.find((item) => item.email?.toLowerCase() === email)

  return {
    user,
    error: result.error,
  }
}

export async function startEmailOtpDiagnostic(request: NextRequest) {
  const body = await readRequestBody(request)
  const email = normalizeEmail(body.email)

  if (!email) {
    return NextResponse.json(
      {
        ok: false,
        error: "Email is required",
      },
      { status: 400 },
    )
  }

  const supabase = get_shared_auth_supabase_client()
  const payload = {
    email,
    options: {
      shouldCreateUser: true,
    },
  }
  const result = await supabase.auth.signInWithOtp(payload)
  const authUserResult = await findAuthUserByEmail(email)
  const authUser = authUserResult.user

  await sendIdentityDebug("email_minimal_otp_start_result", {
    provider: "email",
    payload,
    success: !result.error,
    data: result.data,
    error: serializeError(result.error),
    auth_user: {
      exists: !!authUser,
      auth_user_id: authUser?.id ?? null,
      email_confirmed_at: authUser?.email_confirmed_at ?? null,
      created_at: authUser?.created_at ?? null,
      admin_error: serializeError(authUserResult.error),
    },
  })

  return NextResponse.json({
    ok: !result.error,
    payload,
    data: result.data,
    error: serializeError(result.error),
    auth_user: {
      exists: !!authUser,
      auth_user_id: authUser?.id ?? null,
      email_confirmed_at: authUser?.email_confirmed_at ?? null,
      created_at: authUser?.created_at ?? null,
    },
  })
}

export async function verifyEmailOtpDiagnostic(request: NextRequest) {
  const body = await readRequestBody(request)
  const email = normalizeEmail(body.email)
  const token = normalizeCode(body.token ?? body.code)

  if (!email || !token) {
    return NextResponse.json(
      {
        ok: false,
        error: "Email and token are required",
      },
      { status: 400 },
    )
  }

  const supabase = get_shared_auth_supabase_client()
  const payload = {
    email,
    token,
    type: "email" as const,
  }
  const before = {
    session: await supabase.auth.getSession(),
    user: await supabase.auth.getUser(),
  }
  const authUserResult = await findAuthUserByEmail(email)
  const result = await supabase.auth.verifyOtp(payload)
  const after = {
    session: await supabase.auth.getSession(),
    user: await supabase.auth.getUser(),
  }

  await sendIdentityDebug("email_minimal_otp_verify_result", {
    provider: "email",
    payload,
    success: !result.error,
    before: {
      session_exists: !!before.session.data.session,
      session_user_id: before.session.data.session?.user.id ?? null,
      session_error: serializeError(before.session.error),
      user_id: before.user.data.user?.id ?? null,
      user_error: serializeError(before.user.error),
    },
    after: {
      session_exists: !!after.session.data.session,
      session_user_id: after.session.data.session?.user.id ?? null,
      session_error: serializeError(after.session.error),
      user_id: after.user.data.user?.id ?? null,
      user_error: serializeError(after.user.error),
    },
    data: {
      user_id: result.data.user?.id ?? null,
      user_email: result.data.user?.email ?? null,
      session_exists: !!result.data.session,
    },
    error: serializeError(result.error),
    auth_user: {
      exists: !!authUserResult.user,
      auth_user_id: authUserResult.user?.id ?? null,
      email_confirmed_at: authUserResult.user?.email_confirmed_at ?? null,
      created_at: authUserResult.user?.created_at ?? null,
      admin_error: serializeError(authUserResult.error),
    },
  })

  return NextResponse.json(
    {
      ok: !result.error,
      payload,
      data: {
        user_id: result.data.user?.id ?? null,
        user_email: result.data.user?.email ?? null,
        session_exists: !!result.data.session,
      },
      error: serializeError(result.error),
    },
    { status: result.error?.status ?? 200 },
  )
}
