import type { NextRequest } from "next/server"

import { sendLiffAuthDebug } from "@/core/auth/action"

export async function POST(request: NextRequest) {
  return sendLiffAuthDebug(request)
}
