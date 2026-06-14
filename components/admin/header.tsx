import {
  Bell,
  ChevronDown,
  MoreHorizontal,
  MessageCircle,
  Settings,
  X,
} from "lucide-react"

import RoboNekoCharacter from "@/components/admin/neko"

export default function AdminHeader() {
  return (
    <header className="bg-white px-5 pt-[calc(16px+env(safe-area-inset-top,0px))]">
      <div className="mx-auto w-full max-w-[430px] pb-6">
        <div className="grid grid-cols-[48px_1fr_48px] items-start">
          <div />
          <div className="text-center">
            <p className="text-[14px] font-semibold tracking-[-0.01em] text-neutral-950">
              管理者 <span className="text-neutral-400">|</span> PET TAXI
            </p>
            <p className="mt-2 text-[12px] font-medium text-neutral-500">
              app.da-nya.com
            </p>
          </div>

          <div className="flex items-center justify-end gap-2">
            {[
              { label: "Menu", icon: MoreHorizontal },
              { label: "Close", icon: X },
            ].map((item) => {
              const Icon = item.icon

              return (
                <button
                  key={item.label}
                  type="button"
                  aria-label={item.label}
                  className="flex h-6 w-6 items-center justify-center text-neutral-950"
                >
                  <Icon className="h-5 w-5" strokeWidth={1.8} />
                </button>
              )
            })}
          </div>
        </div>

        <div className="mt-8 flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[22px] border border-neutral-200 bg-neutral-50">
            <div className="scale-[0.58]">
              <RoboNekoCharacter />
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-[22px] font-semibold tracking-[-0.03em] text-neutral-950">
              M.OKINO
            </p>
            <p className="mt-1 text-[13px] font-medium text-neutral-500">
              admin
            </p>
          </div>

          <div className="flex items-center gap-2">
            {[
              { label: "Chat", icon: MessageCircle },
              { label: "Notifications", icon: Bell },
              { label: "Settings", icon: Settings },
              { label: "Open", icon: ChevronDown },
            ].map((item) => {
              const Icon = item.icon

              return (
                <button
                  key={item.label}
                  type="button"
                  aria-label={item.label}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-900"
                >
                  <Icon className="h-4 w-4" strokeWidth={1.8} />
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </header>
  )
}
