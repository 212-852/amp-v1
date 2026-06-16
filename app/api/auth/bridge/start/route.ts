import type { NextRequest } from "next/server"

import { startLoginBridge } from "@/core/auth/action"

export async function POST(request: NextRequest) {
  return startLoginBridge(request)
}
