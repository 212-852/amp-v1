"use client"

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { createPortal } from "react-dom"

import { ToastStack, type ToastAnchorRect, type ToastItem } from "@/components/ui/toast"
import type { ToastInput, ToastTone } from "@/components/ui/use_toast"

const default_duration_ms = 2750

type ToastContextValue = {
  showToast: (input: ToastInput) => void
}

export const ToastContext = createContext<ToastContextValue | null>(null)

function clampDuration(duration_ms: number | undefined) {
  if (!duration_ms) {
    return default_duration_ms
  }

  return Math.min(3000, Math.max(2500, duration_ms))
}

function resolveAnchorRect(
  anchor_ref: ToastInput["anchor_ref"],
): ToastAnchorRect | null {
  const element = anchor_ref?.current

  if (!element) {
    return null
  }

  const rect = element.getBoundingClientRect()

  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
    bottom: rect.bottom,
    right: rect.right,
  }
}

export function ToastProvider({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const [items, set_items] = useState<ToastItem[]>([])
  const [mounted, set_mounted] = useState(false)
  const timers_ref = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  useEffect(() => {
    set_mounted(true)
  }, [])

  const dismiss = useCallback((id: string) => {
    const timer = timers_ref.current.get(id)

    if (timer) {
      clearTimeout(timer)
      timers_ref.current.delete(id)
    }

    set_items((current) => current.filter((item) => item.id !== id))
  }, [])

  const showToast = useCallback(
    (input: ToastInput) => {
      const id = crypto.randomUUID()
      const tone: ToastTone = input.tone ?? "info"
      const duration_ms = clampDuration(input.duration_ms)
      const anchor_rect =
        input.placement === "anchor"
          ? resolveAnchorRect(input.anchor_ref)
          : null

      set_items((current) => [
        ...current,
        {
          id,
          message: input.message,
          tone,
          anchor_rect,
          compact: input.compact,
        },
      ])

      const timer = setTimeout(() => {
        dismiss(id)
      }, duration_ms)

      timers_ref.current.set(id, timer)
    },
    [dismiss],
  )

  useEffect(() => {
    const timers = timers_ref.current

    return () => {
      timers.forEach((timer) => {
        clearTimeout(timer)
      })
      timers.clear()
    }
  }, [])

  const value = useMemo(
    () => ({
      showToast,
    }),
    [showToast],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      {mounted
        ? createPortal(<ToastStack items={items} />, document.body)
        : null}
    </ToastContext.Provider>
  )
}
