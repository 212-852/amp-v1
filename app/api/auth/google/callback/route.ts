import type { NextRequest } from "next/server"

import { completeDirectGoogleOAuthCallback } from "@/core/auth/google"

export async function GET(request: NextRequest) {
  return completeDirectGoogleOAuthCallback(request)
}
