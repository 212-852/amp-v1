import type { NextRequest } from "next/server"

import { sendOtpLogin } from "@/core/auth/action"

export async function POST(request: NextRequest) {
  return sendOtpLogin(request)
}
