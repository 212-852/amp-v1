import { upsertLineContactsFromEvents } from "@/core/line/action"

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    events?: unknown
  }
  const events = Array.isArray(body.events) ? body.events : []

  await upsertLineContactsFromEvents(events)

  return Response.json({ ok: true })
}
