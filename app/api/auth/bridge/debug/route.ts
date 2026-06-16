import type { NextRequest } from "next/server"

import { sendLoginBridgeDebug } from "@/core/auth/action"

export async function POST(request: NextRequest) {
  return sendLoginBridgeDebug(request)
}
