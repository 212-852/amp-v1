"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import { createOverlayAction } from "@/components/overlay/action"
import OverlayOutput from "@/components/overlay/output"
import type {
  OverlayAction,
  OverlayPhase,
  OverlayRequest,
} from "@/components/overlay/types"

type OverlayController = {
  openOverlay: (request: OverlayRequest) => void
  open_overlay: (request: OverlayRequest) => void
  closeOverlay: () => void
}

const OverlayContext = createContext<OverlayController | null>(null)

export function OverlayProvider({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const [action, setAction] = useState<OverlayAction | null>(null)
  const [phase, setPhase] = useState<OverlayPhase>("opening")
  const closeTimerRef = useRef<number | null>(null)
  const frameRef = useRef<number | null>(null)

  const closeOverlay = useCallback(() => {
    if (!action || phase === "closing") {
      return
    }

    setPhase("closing")

    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current)
    }

    closeTimerRef.current = window.setTimeout(() => {
      setAction(null)
      setPhase("opening")
    }, 180)
  }, [action, phase])

  const openOverlay = useCallback((request: OverlayRequest) => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current)
    }

    if (frameRef.current) {
      window.cancelAnimationFrame(frameRef.current)
    }

    setAction(createOverlayAction(request))
    setPhase("opening")

    frameRef.current = window.requestAnimationFrame(() => {
      setPhase("open")
    })
  }, [])

  useEffect(() => {
    if (!action) {
      return
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeOverlay()
      }
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [action, closeOverlay])

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current)
      }

      if (frameRef.current) {
        window.cancelAnimationFrame(frameRef.current)
      }
    }
  }, [])

  const value = useMemo(
    () => ({
      openOverlay,
      open_overlay: openOverlay,
      closeOverlay,
    }),
    [closeOverlay, openOverlay],
  )

  return (
    <OverlayContext.Provider value={value}>
      {children}
      {action ? (
        <OverlayOutput
          action={action}
          phase={phase}
          onClose={closeOverlay}
        />
      ) : null}
    </OverlayContext.Provider>
  )
}

export function useOverlay() {
  const context = useContext(OverlayContext)

  if (!context) {
    throw new Error("useOverlay must be used inside OverlayProvider")
  }

  return context
}
