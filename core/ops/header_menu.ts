import type { SessionRole } from "@/core/auth/types"

export type OpsHeaderNavItem = {
  key: string
  label: string
  href: string
}

const ADMIN_NAV_ITEMS: OpsHeaderNavItem[] = [
  { key: "admin-home", label: "Home", href: "/admin" },
  { key: "chat", label: "Chat List", href: "/admin/list" },
]

const DRIVER_NAV_ITEMS: OpsHeaderNavItem[] = [
  { key: "driver-home", label: "Home", href: "/driver" },
]

function is_admin_ops_role(role: string): role is SessionRole {
  return role === "admin" || role === "owner" || role === "concierge"
}

export function resolve_ops_header_nav_items(role: string): OpsHeaderNavItem[] {
  if (is_admin_ops_role(role)) {
    return ADMIN_NAV_ITEMS
  }

  if (role === "driver") {
    return DRIVER_NAV_ITEMS
  }

  return []
}
