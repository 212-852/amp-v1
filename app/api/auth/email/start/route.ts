import type { NextRequest } from "next/server"

import { startEmailMagicLinkLogin } from "@/core/auth/email"

export async function POST(request: NextRequest) {
  return startEmailMagicLinkLogin(request)
}
