import type { NextRequest } from "next/server"

import { completeEmailMagicLinkCallback } from "@/core/auth/email"

export async function GET(request: NextRequest) {
  return completeEmailMagicLinkCallback(request)
}
