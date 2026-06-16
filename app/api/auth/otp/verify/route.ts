import type { NextRequest } from "next/server"

import { verifyCustomOtpLogin } from "@/core/auth/action"

export async function POST(request: NextRequest) {
  return verifyCustomOtpLogin(request)
}
