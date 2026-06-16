import { startLineLogin } from "@/core/auth/action"

export async function GET() {
  return startLineLogin()
}
