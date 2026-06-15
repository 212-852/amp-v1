import { completeGoogleOAuthCallback } from "@/core/auth/oauth"
import type { NextRequest } from "next/server"

export async function GET(request: NextRequest) {
  return completeGoogleOAuthCallback(request)
}
