import type { BreadcrumbContext } from "@/core/breadcrumb/context"

export type BreadcrumbItem = {
  label: string
  href?: string
}

export function resolve_breadcrumb_items(
  context: BreadcrumbContext,
): BreadcrumbItem[] {
  const pathname = context.pathname

  if (pathname === "/admin") {
    return [{ label: "Home" }]
  }

  if (pathname === "/admin/list") {
    return [
      { label: "Home", href: "/admin" },
      { label: "Chat List" },
    ]
  }

  if (pathname.startsWith("/admin/list/")) {
    return [
      { label: "Home", href: "/admin" },
      { label: "Chat List", href: "/admin/list" },
      { label: context.room_name || "Room" },
    ]
  }

  if (pathname === "/admin/settings") {
    return [
      { label: "Home", href: "/admin" },
      { label: "Settings" },
    ]
  }

  if (pathname.startsWith("/admin")) {
    return [{ label: "Home", href: "/admin" }]
  }

  return []
}
