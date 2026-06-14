import { Bell, Globe2, User } from "lucide-react"

const mock_auth = {
  is_logged_in: false,
  is_linked: false,
}

const header_state = {
  brand: "PET TAXI",
  breadcrumb: "ホーム",
  language_label: "JA",
  user_name: mock_auth.is_logged_in ? "Test User" : "Guest",
}

function MemberPill({ label, filled = false }: { label: string; filled?: boolean }) {
  return (
    <span
      className={[
        "inline-flex h-7 items-center rounded-full px-2.5 text-[12px] font-semibold leading-none",
        filled
          ? "bg-[#8f5d28] text-[#fdfaf6]"
          : "bg-[#fdfaf6] text-[#8f5d28] ring-1 ring-[#dcc7aa]",
      ].join(" ")}
    >
      {label}
    </span>
  )
}

function LinkPill({ label }: { label: string }) {
  return (
    <span className="inline-flex h-[30px] items-center rounded-full bg-[#fdfaf6] px-3 text-[14px] font-semibold leading-none text-[#8f5d28] ring-1 ring-[#dcc7aa]">
      {label}
    </span>
  )
}

function HeaderBottomCurve() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 bottom-[-16px] h-[18px] w-full text-[#ead7c3]"
      preserveAspectRatio="none"
      viewBox="0 0 390 18"
    >
      <path
        d="M0 0H157C166 0 171 5 174 12C176 17 181 17 183 12C186 5 190 2 195 2C200 2 204 5 207 12C209 17 214 17 216 12C219 5 224 0 233 0H390V0H0Z"
        fill="currentColor"
      />
    </svg>
  )
}

export default function AppHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 h-[108px] bg-[#ead7c3] text-[#3d2a19]">
      <div className="mx-auto flex h-full w-full max-w-[430px] items-start justify-between gap-2 px-6 pb-2 pt-[calc(12px+env(safe-area-inset-top,0px))]">
        <div className="min-w-0 pt-1">
          <h1 className="text-[20px] font-semibold leading-none text-[#3d2a19]">
            {header_state.brand}
          </h1>
          <p className="mt-2.5 text-[11px] font-medium leading-none text-[#8c7358]">
            {header_state.breadcrumb}
          </p>
        </div>

        <div className="flex min-w-[200px] flex-col items-end pt-0.5">
          <div className="flex items-center justify-end gap-1.5">
            {!mock_auth.is_logged_in ? (
              <>
                <MemberPill label="Guest" />
                <LinkPill label="連携" />
              </>
            ) : mock_auth.is_linked ? (
              <>
                <MemberPill label="メンバー" filled />
                <LinkPill label="連携済み" />
              </>
            ) : (
              <>
                <MemberPill label="メンバー" filled />
                <LinkPill label="連携" />
              </>
            )}
            <button
              type="button"
              aria-label="Notifications"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[#fdfaf6] text-[#8f5d28] ring-1 ring-[#dcc7aa]"
            >
              <Bell className="h-[22px] w-[22px]" strokeWidth={2} />
            </button>
            <button
              type="button"
              aria-label={`Language ${header_state.language_label}`}
              className="flex h-8 items-center gap-1 rounded-full bg-[#fdfaf6] px-2 text-[#8f5d28] ring-1 ring-[#dcc7aa]"
            >
              <Globe2 className="h-[22px] w-[22px]" strokeWidth={2} />
              <span className="text-[14px] font-semibold leading-none">
                {header_state.language_label}
              </span>
            </button>
          </div>

          <div className="mt-1 flex items-center gap-2">
            <span className="max-w-[112px] truncate text-[14px] font-semibold leading-none text-[#8c7358]">
              {header_state.user_name}
            </span>
            <button
              type="button"
              aria-label="User profile"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[#8f5d28] text-[#fdfaf6]"
            >
              <User className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>
      <HeaderBottomCurve />
    </header>
  )
}
