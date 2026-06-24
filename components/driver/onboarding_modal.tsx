"use client"

import { CheckCircle2, XCircle } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState, type ReactNode } from "react"

import DriverLicenseAccordionPanel, {
  type DriverLicenseAccordionPanelHandle,
} from "@/components/driver/license_accordion_panel"
import type {
  DriverChecklistItem,
  DriverProgressKey,
  DriverStatus,
} from "@/core/driver/context"
import { log_driver_license_step_opened } from "@/core/driver/progress/output"
import { start_ocr_camera } from "@/core/ocr/camera"

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
  user_uuid,
  driver_uuid,
  has_driver,
  has_driver_progress,
  legacy_has_driver_license,
}: Readonly<{
  initial_items: DriverChecklistItem[]
  initial_status: DriverStatus
  completed_count: number
  total_count: number
  user_uuid: string | null
  driver_uuid: string | null
  has_driver: boolean
  has_driver_progress: boolean
  legacy_has_driver_license: boolean
}>) {
  const router = useRouter()
  const [expanded_key, setExpandedKey] = useState<DriverProgressKey | null>(null)
  const [license_camera_stream, setLicenseCameraStream] =
    useState<MediaStream | null>(null)
  const [license_camera_error, setLicenseCameraError] = useState<string | null>(null)
  const item_refs = useRef<Partial<Record<DriverProgressKey, HTMLLIElement | null>>>({})
  const license_panel_ref = useRef<DriverLicenseAccordionPanelHandle>(null)
  const license_camera_stream_ref = useRef<MediaStream | null>(null)

  useEffect(() => {
    if (!expanded_key) {
      return
    }

    const node = item_refs.current[expanded_key]

    if (!node) {
      return
    }

    window.requestAnimationFrame(() => {
      node.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      })
    })
  }, [expanded_key])

  useEffect(() => {
    return () => {
      license_camera_stream_ref.current
        ?.getTracks()
        .forEach((track) => track.stop())
    }
  }, [])

  if (initial_status !== "provisional") {
    return null
  }

  function handleLicenseComplete() {
    router.refresh()
  }

  function stop_license_camera() {
    license_camera_stream_ref.current
      ?.getTracks()
      .forEach((track) => track.stop())
    license_camera_stream_ref.current = null
    setLicenseCameraStream(null)
  }

  async function open_license_step(item: DriverChecklistItem) {
    const current_answer_label = item.current_answer ?? "未回答"

    setExpandedKey("driver_license")
    setLicenseCameraError(null)
    stop_license_camera()

    log_driver_license_step_opened({
      user_uuid,
      driver_uuid,
      has_driver,
      has_driver_progress,
      latest_license_status: item.latest_status,
      legacy_has_driver_license,
      current_answer_label,
      camera_start_requested: true,
      camera_started: false,
      camera_error: null,
    })

    const result = await start_ocr_camera({
      document_type: "driver_license_front",
      facing_mode: "environment",
    })

    if (result.stream) {
      license_camera_stream_ref.current = result.stream
      setLicenseCameraStream(result.stream)
    } else {
      setLicenseCameraError(
        result.error ?? "カメラを起動できませんでした。画像を選択してください。",
      )
    }

    log_driver_license_step_opened({
      user_uuid,
      driver_uuid,
      has_driver,
      has_driver_progress,
      latest_license_status: item.latest_status,
      legacy_has_driver_license,
      current_answer_label,
      camera_start_requested: true,
      camera_started: result.started,
      camera_error: result.error,
    })
  }

  function handle_item_click(item: DriverChecklistItem) {
    const will_open = expanded_key !== item.key

    if (item.key === "driver_license" && will_open) {
      void open_license_step(item)
      return
    }

    if (item.key === "driver_license") {
      stop_license_camera()
    }

    setExpandedKey((current) => (current === item.key ? null : item.key))
  }

  function render_panel(item: DriverChecklistItem) {
    if (item.key === "driver_license") {
      return (
        <DriverLicenseAccordionPanel
          ref={license_panel_ref}
          current_answer={item.current_answer ?? "未回答"}
          initial_entry={item.latest_entry}
          camera_stream={license_camera_stream}
          camera_error={license_camera_error}
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
            const expanded = expanded_key === item.key

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
