"use client"

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import { ToastStack, type ToastItem } from "@/components/ui/toast"
import type { ToastInput, ToastTone } from "@/components/ui/use_toast"

const default_duration_ms = 3000

type ToastContextValue = {
  showToast: (input: ToastInput) => void
}

export const ToastContext = createContext<ToastContextValue | null>(null)

function clampDuration(duration_ms: number | undefined) {
  if (!duration_ms) {
    return default_duration_ms
  }

  return Math.min(3500, Math.max(2500, duration_ms))
}

export function ToastProvider({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const [items, set_items] = useState<ToastItem[]>([])
  const timers_ref = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

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

      set_items((current) => [
        ...current,
        {
          id,
          message: input.message,
          tone,
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
      <ToastStack items={items} />
    </ToastContext.Provider>
  )
}
