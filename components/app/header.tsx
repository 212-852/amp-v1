import { Bell, Globe2, User } from "lucide-react"

const headerState = {
  brand: "PET TAXI",
  pageTitle: "Home",
  memberLabel: "Member",
  linkedLabel: "Linked",
  userName: "Test User",
  languageLabel: "JA",
}

export default function AppHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 h-[120px] bg-[#f1ddbf] text-[#3d2a19]">
      <div className="mx-auto flex h-full w-full max-w-[430px] items-start justify-between gap-3 px-7 pb-3 pt-[env(safe-area-inset-top)]">
        <div className="min-w-0 pt-4">
          <p className="text-[11px] font-bold uppercase leading-none tracking-[0.13em] text-[#7a4e22]">
            {headerState.brand}
          </p>
          <h1 className="mt-2 text-[26px] font-semibold leading-none text-[#3d2a19]">
            {headerState.pageTitle}
          </h1>
        </div>

        <div className="flex min-w-[178px] flex-col items-end pt-3">
          <div className="flex items-center justify-end gap-1.5">
            <span className="rounded-full bg-[#7a4e22] px-2.5 py-1 text-[11px] font-semibold leading-none text-white">
              {headerState.memberLabel}
            </span>
            <span className="rounded-full bg-[#fffaf2] px-2.5 py-1 text-[11px] font-semibold leading-none text-[#7a4e22] ring-1 ring-[#d8bd95]">
              {headerState.linkedLabel}
            </span>
            <button
              type="button"
              aria-label="Notifications"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[#fffaf2] text-[#6a431f] ring-1 ring-[#d8bd95]"
            >
              <Bell className="h-4 w-4" strokeWidth={2} />
            </button>
            <button
              type="button"
              aria-label={`Language ${headerState.languageLabel}`}
              className="flex h-8 items-center gap-1 rounded-full bg-[#fffaf2] px-2 text-[#6a431f] ring-1 ring-[#d8bd95]"
            >
              <Globe2 className="h-4 w-4" strokeWidth={2} />
              <span className="text-[11px] font-semibold">
                {headerState.languageLabel}
              </span>
            </button>
          </div>

          <div className="mt-2 flex items-center gap-2">
            <span className="max-w-[112px] truncate text-[12px] font-semibold text-[#6a431f]">
              {headerState.userName}
            </span>
            <button
              type="button"
              aria-label="User profile"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[#7a4e22] text-white"
            >
              <User className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
