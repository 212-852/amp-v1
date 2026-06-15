import { completeGoogleOAuthCallback } from "@/core/auth/oauth"

export async function GET(request: Request) {
  return completeGoogleOAuthCallback(request)
}
