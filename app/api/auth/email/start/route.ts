import type { NextRequest } from "next/server"

import { startEmailOtpLogin } from "@/core/auth/email"

export async function POST(request: NextRequest) {
  return startEmailOtpLogin(request)
}
