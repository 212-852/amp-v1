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

  if (pathname === "/admin/concierge" || pathname === "/admin/concierge/list") {
    return [
      { label: "Home", href: "/admin" },
      { label: pathname === "/admin/concierge/list" ? "Chat List" : "Chat" },
    ]
  }

  if (pathname.startsWith("/admin/concierge/")) {
    return [
      { label: "Home", href: "/admin" },
      { label: "Chat List", href: "/admin/concierge/list" },
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
