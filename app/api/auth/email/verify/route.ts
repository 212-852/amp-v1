import type { NextRequest } from "next/server"

import { verifyEmailOtpLogin } from "@/core/auth/email"

export async function POST(request: NextRequest) {
  return verifyEmailOtpLogin(request)
}
