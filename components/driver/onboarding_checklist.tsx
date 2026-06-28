"use client"

import { memo, useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"

import DriverTaskModal from "@/components/driver/task_modal"
import OnboardingTaskCard from "@/components/driver/onboarding_task_card"
import { use_driver_preparation } from "@/components/driver/preparation_provider"
import type { DriverTaskOpenSource } from "@/components/driver/task_modal_runtime"
import {
  clear_driver_license_mount_history,
  confirm_driver_task_modal_open,
  consume_driver_task_unmount_reason,
  mark_driver_task_modal_closed,
  resolve_driver_task_unmount_reason,
  set_driver_task_unmount_reason,
  should_emit_driver_task_modal_open,
  try_begin_driver_task_open,
} from "@/components/driver/task_modal_runtime"
import type { DriverOnboardingTaskKey } from "@/core/driver/context"
import { send_ocr_debug } from "@/core/ocr/debug"

const TASK_CARD_OPEN_SOURCE: DriverTaskOpenSource = {
  source_file: "components/driver/onboarding_checklist.tsx",
  source_function: "open_driver_task",
  handler_name: "task_card_on_click",
}

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

export default function DriverOnboardingChecklist() {
  const router = useRouter()
  const {
    items,
    all_complete,
    is_modal_locked,
    get_modal_ocr_state,
  } = use_driver_preparation()
  const [active_task, set_active_task] =
    useState<DriverOnboardingTaskKey | null>(null)
  const active_task_ref = useRef<DriverOnboardingTaskKey | null>(null)
  const pending_close_debug_ref = useRef<{
    active_task: DriverOnboardingTaskKey | null
    reason: string
    scan_state: string
    camera_state: string
  } | null>(null)

  const open_driver_task = useCallback((
    key: DriverOnboardingTaskKey,
    source: DriverTaskOpenSource = TASK_CARD_OPEN_SOURCE,
  ) => {
    const begin_result = try_begin_driver_task_open(key)

    if (!begin_result.ok) {
      void send_ocr_debug("DRIVER_TASK_MODAL_OPEN_SKIPPED", {
        task_key: key,
        reason: begin_result.reason,
        ...source,
      })
      return
    }

    active_task_ref.current = key
    clear_driver_license_mount_history()

    const pathname =
      typeof window === "undefined" ? "/driver" : window.location.pathname

    if (should_emit_driver_task_modal_open(key, source)) {
      void send_ocr_debug("DRIVER_TASK_MODAL_OPEN", {
        task_key: key,
        from: pathname,
        to: pathname,
        ...source,
      })
    }

    confirm_driver_task_modal_open(key)
    set_active_task(key)
  }, [])

  const commit_close_driver_task = useCallback((reason: string, forced = false) => {
    const current_task = active_task_ref.current
    set_driver_task_unmount_reason(
      resolve_driver_task_unmount_reason(forced ? "user_cancel" : reason),
    )
    pending_close_debug_ref.current = {
      active_task: current_task,
      reason,
      ...get_modal_ocr_state(),
    }
    active_task_ref.current = null
    mark_driver_task_modal_closed()
    set_active_task(null)
  }, [get_modal_ocr_state])

  useEffect(() => {
    if (active_task !== null) {
      return
    }

    const close_debug = pending_close_debug_ref.current

    if (!close_debug) {
      return
    }

    pending_close_debug_ref.current = null
    void send_ocr_debug("DRIVER_TASK_MODAL_CLOSED", {
      ...close_debug,
      task_key: close_debug.active_task,
      unmount_reason: consume_driver_task_unmount_reason(),
    })
  }, [active_task])

  const request_close_driver_task = useCallback((reason: string) => {
    const runtime_state = get_modal_ocr_state()
    void send_ocr_debug("DRIVER_TASK_MODAL_CLOSE_REQUESTED", {
      active_task: active_task_ref.current,
      task_key: active_task_ref.current,
      reason,
      ...runtime_state,
    })

    if (is_modal_locked()) {
      void send_ocr_debug("DRIVER_TASK_MODAL_CLOSE_BLOCKED", {
        active_task: active_task_ref.current,
        task_key: active_task_ref.current,
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

    commit_close_driver_task(reason)
    return true
  }, [commit_close_driver_task, get_modal_ocr_state, is_modal_locked])

  const force_close_driver_task = useCallback((reason: string) => {
    void send_ocr_debug("DRIVER_TASK_MODAL_CLOSE_REQUESTED", {
      active_task: active_task_ref.current,
      task_key: active_task_ref.current,
      reason,
      forced: true,
      ...get_modal_ocr_state(),
    })
    commit_close_driver_task(reason, true)
  }, [commit_close_driver_task, get_modal_ocr_state])

  function start_work() {
    if (active_task_ref.current !== null || is_modal_locked()) {
      log_navigation_blocked({
        action: "refresh",
        from: "/driver",
        to: "/driver",
        reason: "start_work",
      })
      return
    }

    log_navigation_requested({
      action: "refresh",
      from: "/driver",
      to: "/driver",
      reason: "start_work",
    })
    router.refresh()
  }

  return (
    <>
      <div className="pb-10 pt-2">
        <header className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-neutral-950">
            稼働準備
          </h1>
          <p className="text-sm leading-6 text-neutral-600">
            すべての準備が完了すると、ドライバーとして稼働できます。
          </p>
        </header>

        <section className="mt-8 space-y-3" aria-label="準備項目一覧">
          {items.map((item) => (
            <MemoizedTaskCard
              key={item.key}
              item={item}
              open_driver_task={open_driver_task}
            />
          ))}
        </section>

        <div className="mt-8">
          <button
            type="button"
            disabled={!all_complete}
            onClick={start_work}
            className="h-12 w-full rounded-full bg-neutral-900 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:bg-neutral-300"
          >
            仕事を開始する
          </button>
        </div>
      </div>

      <DriverTaskModal
        active_task={active_task}
        on_close={request_close_driver_task}
        on_force_close={force_close_driver_task}
        on_save_success={() => commit_close_driver_task("save_completed")}
      />
    </>
  )
}

const MemoizedTaskCard = memo(function MemoizedTaskCard({
  item,
  open_driver_task,
}: Readonly<{
  item: Parameters<typeof OnboardingTaskCard>[0]["item"]
  open_driver_task: (
    key: DriverOnboardingTaskKey,
    source?: DriverTaskOpenSource,
  ) => void
}>) {
  const on_open = useCallback(() => {
    open_driver_task(item.key, TASK_CARD_OPEN_SOURCE)
  }, [item.key, open_driver_task])

  return <OnboardingTaskCard item={item} on_open={on_open} />
})
