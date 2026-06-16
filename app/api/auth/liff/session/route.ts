import type { NextRequest } from "next/server"

import { completeLiffSession } from "@/core/auth/action"

export async function POST(request: NextRequest) {
  return completeLiffSession(request)
}
