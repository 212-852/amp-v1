import { linkCurrentVisitorToIdentity } from "@/core/auth/link"

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const result = await linkCurrentVisitorToIdentity(body)

  return Response.json(result)
}
