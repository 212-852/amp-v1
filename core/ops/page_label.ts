export type OpsPageLabel = "Home" | "Admin" | "Driver" | "My Page"

export function resolvePageLabel(
  pathname: string | null | undefined,
): OpsPageLabel {
  const path = pathname?.trim() || "/"

  if (path.startsWith("/admin")) {
    return "Admin"
  }

  if (path.startsWith("/driver")) {
    return "Driver"
  }

  if (
    path.startsWith("/user") ||
    path.startsWith("/mypage") ||
    path.startsWith("/app")
  ) {
    return "My Page"
  }

  return "Home"
}
