import { NextResponse } from "next/server"
import { unstable_rethrow } from "next/navigation"

import { build_entry_context } from "@/core/entry/context"
import { submit_entry } from "@/core/entry/action"
import { enforce_entry_line_access } from "@/core/route/rules"

export async function POST(request: Request) {
  try {
    const guard = await enforce_entry_line_access()
    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >
    const context = build_entry_context({
      auth: guard.context,
      session: guard.session,
      line_identity: guard.entry_identity,
      body,
    })
    const output = await submit_entry(context)

    return NextResponse.json(output, { status: output.ok ? 200 : 400 })
  } catch (error) {
    unstable_rethrow(error)

    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error ? error.message : "登録できませんでした。",
        redirect_path: null,
      },
      { status: 400 },
    )
  }
}
