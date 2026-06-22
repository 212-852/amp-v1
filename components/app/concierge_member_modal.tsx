"use client"

import { useLocale } from "@/src/components/locale/provider"
import type { Locale } from "@/src/lib/locale"
import { ui_layer_class } from "@/src/ui/layers"

const content = {
  title: {
    ja: "Conciergeはメンバー向けです",
    en: "Concierge is available for members",
    es: "Concierge esta disponible para miembros",
  },
  body: {
    ja: "アカウント連携後、予約サポートや待ち合わせ場所の案内をコンシェルジュに相談できます。",
    en: "After linking your account, you can contact the concierge for reservation support and meeting place assistance.",
    es: "Despues de vincular tu cuenta, puedes contactar al conserje para apoyo con reservas y el punto de encuentro.",
  },
  link_account: {
    ja: "アカウント連携",
    en: "Link account",
    es: "Vincular cuenta",
  },
  not_now: {
    ja: "あとで",
    en: "Not now",
    es: "Ahora no",
  },
}

export default function ConciergeMemberModal({
  open,
  onClose,
  onLinkAccount,
}: Readonly<{
  open: boolean
  onClose: () => void
  onLinkAccount: () => void
}>) {
  const { locale } = useLocale()

  if (!open) {
    return null
  }

  return (
    <div
      className={[
        "fixed inset-0 flex items-center justify-center",
        ui_layer_class.overlay,
      ].join(" ")}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[rgba(61,42,25,0.42)]"
        onMouseDown={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="concierge-member-modal-title"
        className={[
          "relative w-[calc(100%-32px)] max-w-[420px] rounded-[28px] border border-[#dcc7aa] bg-[#fdfaf6] px-5 py-5 text-[#3d2a19] shadow-[0_18px_48px_rgba(61,42,25,0.18)]",
          ui_layer_class.modal,
        ].join(" ")}
      >
        <h2
          id="concierge-member-modal-title"
          className="text-center text-[18px] font-semibold leading-snug"
        >
          {content.title[locale as Locale]}
        </h2>
        <p className="mt-3 text-center text-[14px] font-medium leading-relaxed text-[#8c7358]">
          {content.body[locale as Locale]}
        </p>

        <div className="mt-5 grid gap-2">
          <button
            type="button"
            onClick={onLinkAccount}
            className="flex h-12 w-full items-center justify-center rounded-full bg-[#8f5d28] text-[15px] font-semibold text-[#fdfaf6]"
          >
            {content.link_account[locale as Locale]}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex h-12 w-full items-center justify-center rounded-full bg-transparent text-[15px] font-semibold text-[#8f5d28]"
          >
            {content.not_now[locale as Locale]}
          </button>
        </div>
      </div>
    </div>
  )
}
