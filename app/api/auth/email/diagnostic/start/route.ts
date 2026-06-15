import type { NextRequest } from "next/server"

import { startEmailOtpDiagnostic } from "@/core/auth/email-diagnostic"

export async function POST(request: NextRequest) {
  return startEmailOtpDiagnostic(request)
}
