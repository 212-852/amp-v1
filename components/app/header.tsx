import { Bell, Globe, User } from "lucide-react"

const headerState = {
  brand: "PET TAXI",
  pageTitle: "Home",
  memberLabel: "Member",
  linkedLabel: "Linked",
  languageLabel: "JA",
}

export default function AppHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 h-[118px] bg-[#f3dfc2] text-[#3f2d1d] shadow-[0_1px_0_rgba(118,82,42,0.12)]">
      <div className="flex h-full w-full items-end justify-between gap-3 px-5 pb-5 pt-[calc(18px+env(safe-area-inset-top,0px))]">
        <div className="min-w-0 pb-1">
          <p className="text-[12px] font-black uppercase tracking-[0.14em] text-[#7a4e22]">
            {headerState.brand}
          </p>
          <h1 className="mt-1 truncate text-[28px] font-black leading-none tracking-normal text-[#3b2818]">
            {headerState.pageTitle}
          </h1>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
          <span className="rounded-full bg-[#8a6538] px-2.5 py-1 text-[11px] font-bold leading-none text-white shadow-sm">
            {headerState.memberLabel}
          </span>
          <span className="rounded-full bg-[#fdf8ef] px-2.5 py-1 text-[11px] font-bold leading-none text-[#7a4e22] shadow-sm ring-1 ring-[#d8bd95]">
            {headerState.linkedLabel}
          </span>
          <button
            type="button"
            aria-label="Notifications"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[#fff9f0] text-[#6a431f] shadow-sm ring-1 ring-[#d8bd95]"
          >
            <Bell className="h-[18px] w-[18px]" strokeWidth={2} />
          </button>
          <button
            type="button"
            aria-label={`Language ${headerState.languageLabel}`}
            className="flex h-9 items-center gap-1 rounded-full bg-[#fff9f0] px-2.5 text-[#6a431f] shadow-sm ring-1 ring-[#d8bd95]"
          >
            <Globe className="h-[16px] w-[16px]" strokeWidth={2} />
            <span className="text-[11px] font-black">{headerState.languageLabel}</span>
          </button>
          <button
            type="button"
            aria-label="User profile"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[#7a4e22] text-white shadow-sm"
          >
            <User className="h-[18px] w-[18px]" strokeWidth={2} />
          </button>
        </div>
      </div>
    </header>
  )
}
