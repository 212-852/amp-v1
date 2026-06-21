export async function send_auth_client_debug(
  event: string,
  payload: Record<string, unknown> = {},
) {
  await fetch("/api/auth/debug", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ event, ...payload }),
  }).catch(() => null)
}

export async function request_logout() {
  const response = await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "include",
  })

  if (!response.ok) {
    throw new Error(`logout_failed:${response.status}`)
  }
}
