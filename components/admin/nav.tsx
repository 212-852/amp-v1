import {
  CarFront,
  ClipboardList,
  Gauge,
  Menu,
  MessageCircle,
} from "lucide-react"

const nav_items = [
  { label: "Dashboard", icon: Gauge, active: true },
  { label: "Orders", icon: ClipboardList, active: false },
  { label: "Drivers", icon: CarFront, active: false },
  { label: "Concierge", icon: MessageCircle, active: false },
  { label: "Menu", icon: Menu, active: false },
]

export default function AdminNav() {
  return (
    <nav
      aria-label="Admin navigation"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-neutral-200 bg-white pb-[env(safe-area-inset-bottom)]"
    >
      <div className="mx-auto grid h-[72px] w-full max-w-[430px] grid-cols-5 px-2">
        {nav_items.map((item) => {
          const Icon = item.icon

          return (
            <button
              key={item.label}
              type="button"
              className={[
                "flex flex-col items-center justify-center gap-1 text-[10px] font-medium",
                item.active ? "text-neutral-950" : "text-neutral-400",
              ].join(" ")}
            >
              <Icon className="h-5 w-5" strokeWidth={1.8} />
              <span>{item.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
