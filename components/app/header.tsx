const headerState = {
  brand: "PET TAXI",
  pageTitle: "Home",
  isLoggedIn: false,
  userName: "Momo",
  isLinked: false,
  languageLabel: "JA",
}

function BellIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-[17px] w-[17px]"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.1"
    >
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 7h18s-3 0-3-7" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  )
}

function GlobeIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-[15px] w-[15px]"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.1"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2a15.3 15.3 0 0 1 0 20" />
      <path d="M12 2a15.3 15.3 0 0 0 0 20" />
    </svg>
  )
}

function UserIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-[17px] w-[17px]"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.1"
    >
      <path d="M20 21a8 8 0 0 0-16 0" />
      <circle cx="12" cy="8" r="4" />
    </svg>
  )
}

export default function AppHeader() {
  const authLabel = headerState.isLoggedIn ? headerState.userName : "Guest"

  return (
    <header className="fixed inset-x-0 top-0 z-50 h-[116px] bg-[#f1ddbf] text-[#3d2a19] shadow-[0_1px_0_rgba(122,78,34,0.12)]">
      <div className="flex h-full w-full items-end justify-between gap-2 px-4 pb-4 pt-[calc(18px+env(safe-area-inset-top,0px))]">
        <div className="min-w-0 pb-1.5">
          <p className="text-[11px] font-black uppercase leading-none tracking-[0.14em] text-[#7a4e22]">
            {headerState.brand}
          </p>
          <h1 className="mt-2 truncate text-[26px] font-black leading-none text-[#3d2a19]">
            {headerState.pageTitle}
          </h1>
        </div>

        <div className="flex max-w-[202px] shrink-0 flex-wrap items-center justify-end gap-1.5">
          <span className="max-w-[78px] truncate rounded-full bg-[#7a4e22] px-2.5 py-1.5 text-[11px] font-black leading-none text-white shadow-sm">
            {authLabel}
          </span>
          {headerState.isLinked ? (
            <span className="rounded-full bg-[#fffaf2] px-2.5 py-1.5 text-[11px] font-black leading-none text-[#7a4e22] shadow-sm ring-1 ring-[#d6bb92]">
              Linked
            </span>
          ) : null}
          <button
            type="button"
            aria-label="Notifications"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[#fffaf2] text-[#6a431f] shadow-sm ring-1 ring-[#d6bb92]"
          >
            <BellIcon />
          </button>
          <button
            type="button"
            aria-label={`Language ${headerState.languageLabel}`}
            className="flex h-8 items-center gap-1 rounded-full bg-[#fffaf2] px-2 text-[#6a431f] shadow-sm ring-1 ring-[#d6bb92]"
          >
            <GlobeIcon />
            <span className="text-[11px] font-black">{headerState.languageLabel}</span>
          </button>
          <button
            type="button"
            aria-label="User profile"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[#7a4e22] text-white shadow-sm"
          >
            <UserIcon />
          </button>
        </div>
      </div>
    </header>
  )
}
