import type { NextRequest } from "next/server"

import { logoutCurrentVisitor } from "@/core/auth/action"

export async function POST(request: NextRequest) {
  return logoutCurrentVisitor(request)
}
