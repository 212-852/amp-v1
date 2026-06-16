import type { NextRequest } from "next/server"

import { startLineLogin } from "@/core/auth/action"

export async function GET(request: NextRequest) {
  return startLineLogin(request)
}
