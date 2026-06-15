import { verifyEmailCodeLogin } from "@/core/auth/email"

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const result = await verifyEmailCodeLogin(body)

    return Response.json(result)
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to verify email code",
      },
      { status: 400 },
    )
  }
}
