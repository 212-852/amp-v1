"use client"

import { memo, useCallback, useRef, useState } from "react"

import OnboardingTaskCard from "@/components/driver/onboarding_task_card"
import { useDriverPreparation } from "@/components/driver/preparation_provider"
import DriverTaskModal from "@/components/driver/task_modal"
import {
  mark_driver_task_modal_closed,
  mark_driver_task_modal_open,
} from "@/components/driver/task_modal_runtime"
import type { DriverOnboardingTaskKey } from "@/core/driver/context"
import { send_ocr_debug } from "@/core/ocr/debug"
import type { OcrDocumentType } from "@/ocr/type"

function create_id(prefix: string) {
  const id = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `${prefix}-${id}`
}

function document_type_for_task(task: DriverOnboardingTaskKey): OcrDocumentType {
  if (task === "driver_license") return "driver_license_front"
  if (task === "vehicle") return "vehicle_inspection_certificate"
  if (task === "safety_manager") return "safety_manager_document"
  return "black_plate"
}

export default function DriverOnboardingChecklist() {
  const { items, all_complete } = useDriverPreparation()
  const [active_task, set_active_task] = useState<DriverOnboardingTaskKey | null>(null)
  const active_task_ref = useRef<DriverOnboardingTaskKey | null>(null)
  const [request_id, set_request_id] = useState("")
  const [component_instance_id, set_component_instance_id] = useState("")

  const open_driver_task = useCallback((task_key: DriverOnboardingTaskKey) => {
    if (active_task_ref.current !== null) return
    const next_request_id = create_id("ocr-request")
    const next_component_instance_id = create_id("driver-task")
    set_request_id(next_request_id)
    set_component_instance_id(next_component_instance_id)
    const document_type = document_type_for_task(task_key)
    void send_ocr_debug("DRIVER_TASK_MODAL_OPEN", {
      request_id: next_request_id,
      component_instance_id: next_component_instance_id,
      document_type,
      scan_state: "idle",
      camera_state: "idle",
      task_key,
    })
    mark_driver_task_modal_open(task_key)
    active_task_ref.current = task_key
    set_active_task(task_key)
  }, [])

  const close_driver_task = useCallback((reason: string) => {
    if (!active_task) return
    const document_type = document_type_for_task(active_task)
    const payload = {
      request_id,
      component_instance_id,
      document_type,
      scan_state: "closing",
      camera_state: "stopping",
      task_key: active_task,
      reason,
    }
    void send_ocr_debug("DRIVER_TASK_MODAL_CLOSE_REQUESTED", payload)
    mark_driver_task_modal_closed()
    active_task_ref.current = null
    set_active_task(null)
    void send_ocr_debug("DRIVER_TASK_MODAL_CLOSED", payload)
  }, [active_task, component_instance_id, request_id])

  return (
    <>
      <div className="pb-10 pt-2">
        <header className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-neutral-950">稼働準備</h1>
          <p className="text-sm leading-6 text-neutral-600">
            すべての準備が完了すると、ドライバーとして稼働できます。
          </p>
        </header>

        <section className="mt-8 space-y-3" aria-label="準備項目一覧">
          {items.map((item) => (
            <MemoizedTaskCard key={item.key} item={item} on_open={open_driver_task} />
          ))}
        </section>

        <div className="mt-8">
          <button
            type="button"
            disabled={!all_complete}
            onClick={() => window.location.assign("/driver")}
            className="h-12 w-full rounded-full bg-neutral-900 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:bg-neutral-300"
          >
            仕事を開始する
          </button>
        </div>
      </div>

      <DriverTaskModal
        active_task={active_task}
        request_id={request_id}
        component_instance_id={component_instance_id}
        on_close={close_driver_task}
      />
    </>
  )
}

const MemoizedTaskCard = memo(function MemoizedTaskCard({
  item,
  on_open,
}: Readonly<{
  item: Parameters<typeof OnboardingTaskCard>[0]["item"]
  on_open: (key: DriverOnboardingTaskKey) => void
}>) {
  const handle_open = useCallback(() => on_open(item.key), [item.key, on_open])
  return <OnboardingTaskCard item={item} on_open={handle_open} />
})
