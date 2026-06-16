export function isNextRedirectError(error: unknown) {
  if (typeof error !== "object" || error === null) {
    return false
  }

  const digest = "digest" in error ? String(error.digest) : ""

  return digest.startsWith("NEXT_REDIRECT")
}
