import type { NextRequest } from "next/server"

import { startDirectGoogleOAuth } from "@/core/auth/google"

export async function GET(request: NextRequest) {
  return startDirectGoogleOAuth(request)
}
