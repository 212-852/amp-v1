"use client"

import { CheckCircle2, XCircle } from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"

import DriverLicenseAccordionPanel, {
  type DriverLicenseAccordionPanelHandle,
} from "@/components/driver/license_accordion_panel"
import type {
  DriverChecklistItem,
  DriverProgressKey,
  DriverStatus,
} from "@/core/driver/context"
import { send_ocr_debug } from "@/core/ocr/debug"

const OCR_ACCORDION_STORAGE_KEY = "amp_driver_ocr_expanded_key"

function read_stored_open_key(): DriverProgressKey | null {
  if (typeof window === "undefined") {
    return null
  }

  const value = window.sessionStorage.getItem(OCR_ACCORDION_STORAGE_KEY)

  return value === "driver_license" ? value : null
}

function store_open_key(key: DriverProgressKey | null) {
  if (typeof window === "undefined") {
    return
  }

  if (key) {
    window.sessionStorage.setItem(OCR_ACCORDION_STORAGE_KEY, key)
    return
  }

  window.sessionStorage.removeItem(OCR_ACCORDION_STORAGE_KEY)
}

function ProgressStatusIcon({ complete }: Readonly<{ complete: boolean }>) {
  if (complete) {
    return (
      <CheckCircle2
        aria-hidden="true"
        className="h-5 w-5 shrink-0 text-emerald-600"
        strokeWidth={2.25}
      />
    )
  }

  return (
    <XCircle
      aria-hidden="true"
      className="h-5 w-5 shrink-0 text-red-600"
      strokeWidth={2.25}
    />
  )
}

function AccordionPanel({
  expanded,
  children,
}: Readonly<{
  expanded: boolean
  children: ReactNode
}>) {
  return (
    <div
      className="grid transition-[grid-template-rows] duration-300 ease-in-out motion-reduce:transition-none"
      style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
    >
      <div className="overflow-hidden">{children}</div>
    </div>
  )
}

function PlaceholderPanel({ label }: Readonly<{ label: string }>) {
  return (
    <div className="border-t border-neutral-100 px-4 pb-4 pt-3">
      <p className="text-sm leading-6 text-neutral-600">
        {label}の登録は準備中です。
      </p>
    </div>
  )
}

export default function DriverOnboardingModal({
  initial_items,
  initial_status,
  completed_count,
  total_count,
}: Readonly<{
  initial_items: DriverChecklistItem[]
  initial_status: DriverStatus
  completed_count: number
  total_count: number
}>) {
  const router = useRouter()
  const [open_key, setOpenKey] = useState<DriverProgressKey | null>(
    read_stored_open_key,
  )
  const [locked_key, setLockedKey] = useState<DriverProgressKey | null>(null)
  const license_panel_ref = useRef<DriverLicenseAccordionPanelHandle>(null)
  const license_camera_started_ref = useRef(false)
  const item_refs = useRef<Partial<Record<DriverProgressKey, HTMLLIElement | null>>>({})

  const handle_ocr_lock = useCallback(() => {
    setOpenKey("driver_license")
    setLockedKey("driver_license")
    store_open_key("driver_license")
  }, [])

  const handle_ocr_unlock = useCallback(() => {
    setLockedKey(null)
  }, [])

  const handle_ocr_cancel = useCallback(() => {
    void send_ocr_debug("OCR_ACCORDION_CANCEL", {
      key: "driver_license",
    })
    setLockedKey(null)
    license_camera_started_ref.current = false
    license_panel_ref.current?.stop_camera("user_close")
  }, [])

  useEffect(() => {
    if (!locked_key) {
      return
    }

    if (open_key !== locked_key) {
      void send_ocr_debug("OCR_ACCORDION_CLOSE_BLOCKED", {
        key: locked_key,
        reason: "forced_open_restore",
        open_key,
      })
      setOpenKey(locked_key)
      store_open_key(locked_key)
    }
  }, [locked_key, open_key])

  useEffect(() => {
    if (!open_key) {
      return
    }

    const node = item_refs.current[open_key]

    if (!node) {
      return
    }

    window.requestAnimationFrame(() => {
      node.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      })
    })
  }, [open_key])

  if (initial_status !== "provisional") {
    return null
  }

  function handle_accordion_value_change(next_key: DriverProgressKey | null) {
    if (locked_key && next_key !== locked_key) {
      void send_ocr_debug("OCR_ACCORDION_CLOSE_BLOCKED", {
        key: locked_key,
        reason: "accordion_value_change",
        next_key,
      })
      setOpenKey(locked_key)
      store_open_key(locked_key)
      return
    }

    if (next_key === "driver_license") {
      void send_ocr_debug("OCR_ACCORDION_OPEN", { key: next_key })
    } else if (open_key === "driver_license") {
      license_camera_started_ref.current = false
      if (!locked_key) {
        license_panel_ref.current?.stop_camera("accordion_close")
      }
    }

    store_open_key(next_key)
    setOpenKey(next_key)
  }

  function handleLicenseComplete() {
    router.refresh()
  }

  function start_license_camera_once() {
    if (license_camera_started_ref.current) {
      return
    }

    license_camera_started_ref.current = true
    void license_panel_ref.current?.open_from_user_gesture()
  }

  function handle_item_click(item: DriverChecklistItem) {
    const will_open = open_key !== item.key

    if (locked_key === item.key) {
      void send_ocr_debug("OCR_ACCORDION_CLOSE_BLOCKED", {
        key: item.key,
        reason: "locked_during_ocr",
      })
      setOpenKey(item.key)
      store_open_key(item.key)
      return
    }

    if (item.key === "driver_license" && will_open) {
      handle_ocr_lock()
      start_license_camera_once()
      return
    }

    if (item.key === "driver_license" && !will_open && !locked_key) {
      license_panel_ref.current?.stop_camera("accordion_close")
      license_camera_started_ref.current = false
    }

    if (
      open_key === "driver_license" &&
      item.key !== "driver_license" &&
      !locked_key
    ) {
      license_panel_ref.current?.stop_camera("accordion_close")
      license_camera_started_ref.current = false
    }

    handle_accordion_value_change(will_open ? item.key : null)
  }

  function render_panel(item: DriverChecklistItem) {
    if (item.key === "driver_license") {
      const license_is_open =
        open_key === "driver_license" || locked_key === "driver_license"

      return (
        <DriverLicenseAccordionPanel
          ref={license_panel_ref}
          current_answer={item.current_answer ?? "未回答"}
          initial_entry={item.latest_entry}
          is_open={license_is_open}
          accordion_locked={locked_key === "driver_license"}
          on_lock={handle_ocr_lock}
          on_unlock={handle_ocr_unlock}
          on_cancel={handle_ocr_cancel}
          onComplete={handleLicenseComplete}
        />
      )
    }

    return <PlaceholderPanel label={item.label} />
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-5 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="driver-onboarding-title"
    >
      <div className="flex max-h-[min(720px,100dvh)] w-full max-w-[430px] flex-col overflow-hidden rounded-3xl bg-white shadow-[0_24px_64px_rgba(0,0,0,0.35)]">
        <div className="border-b border-neutral-200 px-5 py-5">
          <h2
            id="driver-onboarding-title"
            className="text-lg font-bold text-neutral-950"
          >
            稼働準備
          </h2>
          <p className="mt-1 text-sm leading-6 text-neutral-600">
            すべての準備が完了すると、ドライバー画面が利用できます。
          </p>
          <p className="mt-3 text-sm font-semibold text-neutral-900">
            進捗 {completed_count}/{total_count}
          </p>
        </div>

        <ul className="flex-1 space-y-2 overflow-y-auto px-5 py-4">
          {(initial_items ?? []).map((item) => {
            const expanded =
              open_key === item.key || locked_key === item.key

            return (
              <li
                key={item.key}
                ref={(node) => {
                  item_refs.current[item.key] = node
                }}
                className="overflow-hidden rounded-2xl border border-neutral-200 bg-white"
              >
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => handle_item_click(item)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-neutral-50"
                >
                  <ProgressStatusIcon complete={item.complete} />
                  <span className="text-[15px] font-medium leading-6 text-neutral-900">
                    {item.label}
                  </span>
                </button>

                <AccordionPanel expanded={expanded}>{render_panel(item)}</AccordionPanel>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
