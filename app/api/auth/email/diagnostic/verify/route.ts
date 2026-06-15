import type { NextRequest } from "next/server"

import { verifyEmailOtpDiagnostic } from "@/core/auth/email-diagnostic"

export async function POST(request: NextRequest) {
  return verifyEmailOtpDiagnostic(request)
}
