"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"

export default function CenterStatusToast({
  message,
}: Readonly<{
  message: string | null
}>) {
  const [mounted, set_mounted] = useState(false)

  useEffect(() => {
    set_mounted(true)
  }, [])

  if (!mounted || !message) {
    return null
  }

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed z-[99999] w-[min(86vw,340px)] -translate-x-1/2 -translate-y-1/2 rounded-[16px] border-0 bg-[rgba(0,0,0,0.82)] px-4 py-3 text-center text-[13px] font-semibold leading-snug text-white shadow-[0_12px_32px_rgba(0,0,0,0.22)] backdrop-blur-[12px]"
      style={{
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
      }}
    >
      <span className="whitespace-pre-line">{message}</span>
    </div>,
    document.body,
  )
}
