import { NextResponse } from "next/server"

export function GET(request: Request) {
  return NextResponse.redirect(new URL("/images/icon_192.png", request.url), 307)
}
