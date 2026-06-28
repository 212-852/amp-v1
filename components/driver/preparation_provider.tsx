"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import type {
  DriverChecklistItem,
  DriverOnboardingTaskKey,
} from "@/core/driver/context"
import { send_ocr_debug } from "@/core/ocr/debug"

type DriverPreparationContextValue = {
  items: DriverChecklistItem[]
  all_complete: boolean
  can_operate: boolean
  open_task_key: DriverOnboardingTaskKey | null
  modal_locked: boolean
  get_item: (key: DriverOnboardingTaskKey) => DriverChecklistItem | null
  replace_items: (items: DriverChecklistItem[]) => void
  update_item: (
    key: DriverOnboardingTaskKey,
    patch: Partial<DriverChecklistItem>,
  ) => void
  open_task: (key: DriverOnboardingTaskKey) => void
  set_modal_locked: (locked: boolean) => void
  request_close_modal: (reason: string) => boolean
  close_modal: (reason: string) => void
  force_close_modal: (reason: string) => void
  request_driver_refresh: (reason: string) => boolean
}

const DriverPreparationContext =
  createContext<DriverPreparationContextValue | null>(null)

function log_navigation_requested(input: {
  from: string
  to: string
  reason: string
  action: "push" | "replace" | "back" | "refresh"
}) {
  void send_ocr_debug("OCR_NAVIGATION_REQUESTED", input)
}

function log_navigation_blocked(input: {
  from: string
  to: string
  reason: string
  action: "push" | "replace" | "back" | "refresh"
}) {
  void send_ocr_debug("OCR_NAVIGATION_BLOCKED_DURING_OCR", input)
}

export function DriverPreparationProvider({
  initial_items,
  initial_all_complete,
  can_operate,
  children,
}: Readonly<{
  initial_items: DriverChecklistItem[]
  initial_all_complete: boolean
  can_operate: boolean
  children: ReactNode
}>) {
  const [items, setItems] = useState(initial_items)
  const [open_task_key, setOpenTaskKey] =
    useState<DriverOnboardingTaskKey | null>(null)
  const [modal_locked, setModalLocked] = useState(false)

  const replace_items = useCallback((next_items: DriverChecklistItem[]) => {
    setItems(next_items)
  }, [])

  const update_item = useCallback(
    (key: DriverOnboardingTaskKey, patch: Partial<DriverChecklistItem>) => {
      setItems((current) =>
        current.map((item) =>
          item.key === key
            ? {
                ...item,
                ...patch,
              }
            : item,
        ),
      )
    },
    [],
  )

  const get_item = useCallback(
    (key: DriverOnboardingTaskKey) =>
      items.find((item) => item.key === key) ?? null,
    [items],
  )

  const all_complete = useMemo(
    () => items.length > 0 && items.every((item) => item.complete),
    [items],
  )

  const open_task = useCallback((key: DriverOnboardingTaskKey) => {
    void send_ocr_debug("DRIVER_TASK_MODAL_OPEN", {
      task_key: key,
      from: "/driver",
      to: "/driver",
    })
    setOpenTaskKey(key)
  }, [])

  const set_modal_locked = useCallback((locked: boolean) => {
    setModalLocked(locked)
  }, [])

  const close_modal = useCallback((reason: string) => {
    void send_ocr_debug("DRIVER_TASK_MODAL_CLOSED", {
      task_key: open_task_key,
      reason,
    })
    setOpenTaskKey(null)
    setModalLocked(false)
  }, [open_task_key])

  const force_close_modal = useCallback((reason: string) => {
    void send_ocr_debug("DRIVER_TASK_MODAL_CLOSED", {
      task_key: open_task_key,
      reason,
      forced: true,
    })
    setOpenTaskKey(null)
    setModalLocked(false)
  }, [open_task_key])

  const request_close_modal = useCallback((reason: string) => {
    void send_ocr_debug("DRIVER_TASK_MODAL_CLOSE_REQUESTED", {
      task_key: open_task_key,
      reason,
    })

    if (modal_locked) {
      void send_ocr_debug("DRIVER_TASK_MODAL_CLOSE_BLOCKED", {
        task_key: open_task_key,
        reason,
      })
      log_navigation_blocked({
        action: "push",
        from: "/driver",
        to: "/driver",
        reason: `modal_close_blocked:${reason}`,
      })
      return false
    }

    close_modal(reason)
    return true
  }, [close_modal, modal_locked, open_task_key])

  const request_driver_refresh = useCallback((reason: string) => {
    if (modal_locked || open_task_key) {
      log_navigation_blocked({
        action: "refresh",
        from: "/driver",
        to: "/driver",
        reason,
      })
      return false
    }

    log_navigation_requested({
      action: "refresh",
      from: "/driver",
      to: "/driver",
      reason,
    })
    return true
  }, [modal_locked, open_task_key])

  const value = useMemo(
    () => ({
      items,
      all_complete,
      can_operate,
      open_task_key,
      modal_locked,
      get_item,
      replace_items,
      update_item,
      open_task,
      set_modal_locked,
      request_close_modal,
      close_modal,
      force_close_modal,
      request_driver_refresh,
    }),
    [
      all_complete,
      can_operate,
      close_modal,
      force_close_modal,
      get_item,
      items,
      modal_locked,
      open_task,
      open_task_key,
      replace_items,
      request_close_modal,
      request_driver_refresh,
      set_modal_locked,
      update_item,
    ],
  )

  return (
    <DriverPreparationContext.Provider value={value}>
      {children}
    </DriverPreparationContext.Provider>
  )
}

export function use_driver_preparation_optional() {
  return useContext(DriverPreparationContext)
}

export function use_driver_preparation() {
  const context = useContext(DriverPreparationContext)

  if (!context) {
    throw new Error("use_driver_preparation must be used within DriverPreparationProvider")
  }

  return context
}
