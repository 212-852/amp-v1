"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
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
  get_item: (key: DriverOnboardingTaskKey) => DriverChecklistItem | null
  replace_items: (items: DriverChecklistItem[]) => void
  update_item: (
    key: DriverOnboardingTaskKey,
    patch: Partial<DriverChecklistItem>,
  ) => void
  open_task: (key: DriverOnboardingTaskKey) => void
  set_modal_locked: (locked: boolean) => void
  set_modal_ocr_state: (scan_state: string, camera_state: string) => void
  request_close_modal: (reason: string) => boolean
  close_modal: (reason: string) => void
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
  const [active_task, set_active_task] =
    useState<DriverOnboardingTaskKey | null>(null)
  const active_task_ref = useRef<DriverOnboardingTaskKey | null>(null)
  const modal_locked_ref = useRef(false)
  const modal_ocr_state_ref = useRef({
    scan_state: "idle",
    camera_state: "idle",
  })

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
    active_task_ref.current = key
    modal_ocr_state_ref.current = {
      scan_state: "idle",
      camera_state: "idle",
    }
    set_active_task(key)
  }, [])

  const set_modal_locked = useCallback((locked: boolean) => {
    modal_locked_ref.current = locked
  }, [])

  const set_modal_ocr_state = useCallback((
    scan_state: string,
    camera_state: string,
  ) => {
    modal_ocr_state_ref.current = { scan_state, camera_state }
  }, [])

  const commit_close_modal = useCallback((reason: string) => {
    const active_task = active_task_ref.current
    void send_ocr_debug("DRIVER_TASK_MODAL_CLOSED", {
      active_task,
      task_key: active_task,
      reason,
      ...modal_ocr_state_ref.current,
    })
    active_task_ref.current = null
    modal_locked_ref.current = false
    set_active_task(null)
  }, [])

  const close_modal = useCallback((reason: string) => {
    const active_task = active_task_ref.current
    void send_ocr_debug("DRIVER_TASK_MODAL_CLOSE_REQUESTED", {
      active_task,
      task_key: active_task,
      reason,
      ...modal_ocr_state_ref.current,
    })
    commit_close_modal(reason)
  }, [commit_close_modal])

  const request_close_modal = useCallback((reason: string) => {
    const active_task = active_task_ref.current
    const runtime_state = modal_ocr_state_ref.current
    void send_ocr_debug("DRIVER_TASK_MODAL_CLOSE_REQUESTED", {
      active_task,
      task_key: active_task,
      reason,
      ...runtime_state,
    })

    if (modal_locked_ref.current) {
      void send_ocr_debug("DRIVER_TASK_MODAL_CLOSE_BLOCKED", {
        active_task,
        task_key: active_task,
        reason,
        ...runtime_state,
      })
      log_navigation_blocked({
        action: "push",
        from: "/driver",
        to: "/driver",
        reason: `modal_close_blocked:${reason}`,
      })
      return false
    }

    commit_close_modal(reason)
    return true
  }, [commit_close_modal])

  const request_driver_refresh = useCallback((reason: string) => {
    if (modal_locked_ref.current || active_task_ref.current) {
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
  }, [])

  const value = useMemo(
    () => ({
      items,
      all_complete,
      can_operate,
      open_task_key: active_task,
      get_item,
      replace_items,
      update_item,
      open_task,
      set_modal_locked,
      set_modal_ocr_state,
      request_close_modal,
      close_modal,
      request_driver_refresh,
    }),
    [
      all_complete,
      can_operate,
      close_modal,
      get_item,
      items,
      open_task,
      active_task,
      replace_items,
      request_close_modal,
      request_driver_refresh,
      set_modal_locked,
      set_modal_ocr_state,
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
