import {
  Bell,
  Menu,
  MessageCircle,
  Settings,
} from "lucide-react"

export default function AdminHeader() {
  return (
    <header className="px-5 pt-[calc(16px+env(safe-area-inset-top,0px))]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[13px] font-semibold tracking-[-0.01em] text-neutral-950">
            管理者 <span className="text-neutral-400">|</span> PET TAXI
          </p>
          <p className="mt-1 text-[12px] font-medium text-neutral-500">
            app.da-nya.com
          </p>
        </div>

        <div className="flex items-center gap-2">
          {[
            { label: "Chat", icon: MessageCircle },
            { label: "Notifications", icon: Bell },
            { label: "Settings", icon: Settings },
            { label: "Menu", icon: Menu },
          ].map((item) => {
            const Icon = item.icon

            return (
              <button
                key={item.label}
                type="button"
                aria-label={item.label}
                className="flex h-12 w-12 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-900 shadow-[0_4px_14px_rgba(0,0,0,0.04)]"
              >
                <Icon className="h-5 w-5" strokeWidth={1.8} />
              </button>
            )
          })}
        </div>
      </div>
    </header>
  )
}
