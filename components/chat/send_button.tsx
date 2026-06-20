"use client"

import { PawPrint } from "lucide-react"

import type { Locale } from "@/src/lib/locale"

const content = {
  send: {
    ja: "送信",
    en: "Send",
    es: "Enviar",
  },
} satisfies Record<string, Record<Locale, string>>

const size_class = {
  user: {
    button:
      "flex h-[62px] w-[58px] shrink-0 items-center justify-center bg-transparent p-0 text-[#8f5d28] shadow-none disabled:cursor-not-allowed disabled:opacity-45",
    icon: "h-[58px] w-[58px] fill-[#8f5d28] text-[#8f5d28]",
  },
  compact: {
    button:
      "inline-flex h-11 w-11 shrink-0 items-center justify-center bg-transparent p-0 text-[#8f5d28] shadow-none disabled:cursor-not-allowed disabled:opacity-45",
    icon: "h-10 w-10 fill-[#8f5d28] text-[#8f5d28]",
  },
} as const

export default function ChatSendButton({
  locale,
  disabled = false,
  variant = "user",
  type = "button",
  onClick,
}: Readonly<{
  locale: Locale
  disabled?: boolean
  variant?: keyof typeof size_class
  type?: "button" | "submit"
  onClick?: () => void
}>) {
  const classes = size_class[variant]

  return (
    <button
      type={type}
      aria-label={content.send[locale]}
      disabled={disabled}
      onClick={onClick}
      className={classes.button}
    >
      <PawPrint
        aria-hidden="true"
        className={classes.icon}
        strokeWidth={3}
      />
    </button>
  )
}
