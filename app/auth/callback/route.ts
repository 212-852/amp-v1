import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  return NextResponse.redirect(new URL("/?auth_error=unsupported_callback", request.url))
}
