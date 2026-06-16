import type { NextRequest } from "next/server"

import { getLoginBridgeStatus } from "@/core/auth/action"

export async function GET(request: NextRequest) {
  return getLoginBridgeStatus(request)
}
