const mock_header = {
  brand: "PET TAXI",
  page_title: "Home",
  member_label: "Member",
  linked_label: "Linked",
  language_label: "JA",
  user_initials: "MO",
}

function BellIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
    >
      <path d="M18 8a6 6 0 10-12 0c0 7-3 7-3 7h18s-3 0-3-7" />
      <path d="M13.7 21a2 2 0 01-3.4 0" />
    </svg>
  )
}

export default function AppHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-[#e8d8c3] bg-[#f6e5cf]">
      <div className="mx-auto flex h-24 w-full max-w-[430px] items-center justify-between gap-3 px-4">
        <div className="min-w-0">
          <p className="text-[11px] font-bold tracking-[0.12em] text-[#8b6f47]">
            {mock_header.brand}
          </p>
          <h1 className="truncate text-lg font-bold text-[#3d2f24]">
            {mock_header.page_title}
          </h1>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <span className="rounded-full border border-[#d9c5a8] bg-white px-2 py-0.5 text-[10px] font-bold text-[#6f573d]">
            {mock_header.member_label}
          </span>
          <span className="rounded-full border border-[#d9c5a8] bg-[#fff8ef] px-2 py-0.5 text-[10px] font-bold text-[#6f573d]">
            {mock_header.linked_label}
          </span>
          <button
            type="button"
            aria-label="Notifications"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[#d9c5a8] bg-white text-[#5c4835]"
          >
            <BellIcon />
          </button>
          <span className="px-1 text-xs font-bold text-[#6f573d]">
            {mock_header.language_label}
          </span>
          <button
            type="button"
            aria-label="User profile"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[#8b6f47] text-xs font-bold text-white"
          >
            {mock_header.user_initials}
          </button>
        </div>
      </div>
    </header>
  )
}
