import { startGoogleOAuth } from "@/core/auth/oauth"

export async function GET(request: Request) {
  return startGoogleOAuth(request)
}
