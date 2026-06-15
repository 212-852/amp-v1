import { sendIdentityLinkStartedFromInput } from "@/core/auth/identity"

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>

  await sendIdentityLinkStartedFromInput(body)

  return Response.json({ ok: true })
}
