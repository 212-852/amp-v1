import {
  Bell,
  CarFront,
  ClipboardList,
  Gauge,
  Menu,
  MessageCircle,
  Settings,
  Store,
  UserRound,
  UsersRound,
} from "lucide-react"

export const adminPrimaryNav = [
  { label: "Dashboard", href: "/admin", icon: Gauge },
  { label: "Orders", href: "/admin/orders", icon: ClipboardList },
  { label: "Drivers", href: "/admin/drivers", icon: CarFront },
  { label: "Chat", href: "/admin/list", icon: MessageCircle },
  { label: "Menu", href: "/admin/settings", icon: Menu },
]

export const adminSectionNav = [
  { label: "Dashboard", href: "/admin", icon: Gauge },
  { label: "Orders", href: "/admin/orders", icon: ClipboardList },
  { label: "Drivers", href: "/admin/drivers", icon: CarFront },
  { label: "Chat", href: "/admin/list", icon: MessageCircle },
  { label: "Users", href: "/admin/users", icon: UsersRound },
  { label: "Partners", href: "/admin/partners", icon: Store },
  { label: "Notifications", href: "/admin/notifications", icon: Bell },
  { label: "Settings", href: "/admin/settings", icon: Settings },
]

export const AdminAccountIcon = UserRound
