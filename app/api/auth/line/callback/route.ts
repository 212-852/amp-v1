import type { NextRequest } from "next/server"

import { completeLineLogin } from "@/core/auth/action"

export async function GET(request: NextRequest) {
  return completeLineLogin(request)
}
