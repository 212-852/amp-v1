"use client"

import {
  forwardRef,
  useImperativeHandle,
  type ChangeEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react"

import { use_driver_preparation } from "@/components/driver/preparation_provider"
import DocumentScanner, {
  type DocumentScannerHandle,
} from "@/components/ocr/document_scanner"
import OcrFlowStatus from "@/components/ocr/flow_status"
import { read_file_as_data_url } from "@/core/ocr/camera"
import type { DriverProgressEntry } from "@/core/driver/context"
import type { DriverProgressState } from "@/core/driver/progress/rules"
import {
  run_driver_license_ocr_pipeline,
  type OcrImageSource,
} from "@/core/ocr/client"
import { send_ocr_debug, set_ocr_debug_context } from "@/core/ocr/debug"
import {
  is_ocr_accordion_locked,
  reduce_ocr_flow,
  type OcrFlowEvent,
  type OcrFailureType,
  type OcrFlowState,
} from "@/core/ocr/flow"

function create_task_instance_id() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }

  return `driver-license-task-${Date.now()}`
}

type LicenseFormFields = {
  license_name: string
  license_address: string
  license_birth_date: string
  license_number: string
  license_expiration_date: string
}

function empty_form(): LicenseFormFields {
  return {
    license_name: "",
    license_address: "",
    license_birth_date: "",
    license_number: "",
    license_expiration_date: "",
  }
}

function form_from_entry(entry: DriverProgressEntry | null | undefined): LicenseFormFields {
  if (!entry) {
    return empty_form()
  }

  return {
    license_name: entry.license_name ?? "",
    license_address: entry.license_address ?? "",
    license_birth_date: entry.license_birth_date ?? "",
    license_number: entry.license_number ?? "",
    license_expiration_date: entry.license_expiration_date ?? "",
  }
}

function form_is_complete(form: LicenseFormFields) {
  return (
    Boolean(form.license_name.trim()) &&
    Boolean(form.license_address.trim()) &&
    Boolean(form.license_birth_date.trim()) &&
    Boolean(form.license_number.trim()) &&
    Boolean(form.license_expiration_date.trim())
  )
}

export type DriverLicenseTaskHandle = {
  prepare_modal_close: () => void
}

const DriverLicenseTask = forwardRef<
  DriverLicenseTaskHandle,
  Readonly<{
    initial_entry: DriverProgressEntry | null
    on_save_success: (state?: unknown) => void
  }>
>(function DriverLicenseTask({ initial_entry, on_save_success }, ref) {
  const {
    update_item,
    get_item,
    set_modal_locked,
    set_modal_ocr_state,
  } = use_driver_preparation()
  const component_instance_id_ref = useRef(create_task_instance_id())
  const scanner_ref = useRef<DocumentScannerHandle>(null)
  const camera_started_ref = useRef(false)
  const [ocr_flow_state, dispatch_ocr_flow] = useReducer(
    reduce_ocr_flow,
    "idle",
  )
  const ocr_flow_state_ref = useRef<OcrFlowState>(ocr_flow_state)
  ocr_flow_state_ref.current = ocr_flow_state
  const [image_url, setImageUrl] = useState(initial_entry?.image_url ?? "")
  const [captured_preview_url, setCapturedPreviewUrl] = useState("")
  const [ocr_failure_type, setOcrFailureType] =
    useState<OcrFailureType | null>(null)
  const [form, setForm] = useState<LicenseFormFields>(() => form_from_entry(initial_entry))
  const [scanner_running, setScannerRunning] = useState(false)
  const [ocr_loading, setOcrLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [show_camera_start, setShowCameraStart] = useState(
    () => !initial_entry?.image_url?.trim(),
  )

  useLayoutEffect(() => {
    void send_ocr_debug("DRIVER_TASK_MODAL_BODY_RENDER", {
      task_key: "driver_license",
      component_instance_id: component_instance_id_ref.current,
    })
  }, [])

  useEffect(() => {
    const camera_state = scanner_running ? "running" : ocr_flow_state
    set_modal_ocr_state(ocr_flow_state, camera_state)
    set_modal_locked(is_ocr_accordion_locked(ocr_flow_state))
  }, [
    ocr_flow_state,
    scanner_running,
    set_modal_locked,
    set_modal_ocr_state,
  ])

  set_ocr_debug_context({
    component_instance_id: component_instance_id_ref.current,
    document_type: "driver_license_front",
    scan_state: ocr_flow_state,
    camera_state: scanner_running ? "running" : ocr_flow_state,
  })

  const preview_url = useMemo(() => {
    if (!image_url.startsWith("data:")) {
      return null
    }

    return image_url
  }, [image_url])

  const handle_scanner_running_change = useCallback((running: boolean) => {
    setScannerRunning(running)

    if (running) {
      setShowCameraStart(false)
    }
  }, [])

  const handle_ocr_flow_event = useCallback((event: OcrFlowEvent) => {
    const previous_state = ocr_flow_state_ref.current
    const next_state = reduce_ocr_flow(previous_state, event)
    ocr_flow_state_ref.current = next_state
    set_modal_ocr_state(next_state, next_state)
    set_modal_locked(is_ocr_accordion_locked(next_state))
    dispatch_ocr_flow(event)

    void send_ocr_debug("OCR_SCAN_STATE_CHANGED", {
      document_type: "driver_license_front",
      component_instance_id: component_instance_id_ref.current,
      previous_state,
      next_state,
      event,
    })
  }, [set_modal_locked, set_modal_ocr_state])

  const apply_saved_license_state = useCallback((state: unknown) => {
    const progress_state = state as DriverProgressState | undefined
    const saved_item = progress_state?.items?.find(
      (item) => item.key === "driver_license",
    )

    if (saved_item) {
      update_item("driver_license", saved_item)
      return
    }

    update_item("driver_license", {
      complete: true,
      task_status: "complete",
    })
  }, [update_item])

  const finish_save = useCallback((state?: unknown) => {
    if (state) {
      apply_saved_license_state(state)
    }

    set_modal_locked(false)
    on_save_success(state)
  }, [apply_saved_license_state, on_save_success, set_modal_locked])

  const mark_license_in_progress = useCallback(() => {
    update_item("driver_license", {
      task_status: "in_progress",
    })
  }, [update_item])

  const report_scan_failure = useCallback((
    failure_type: OcrFailureType,
    details: Record<string, unknown> = {},
  ) => {
    setOcrFailureType(failure_type)
    setMessage(null)

    if (ocr_flow_state_ref.current !== "failed") {
      handle_ocr_flow_event("flow_failed")
    }

    const payload = {
      document_type: "driver_license_front",
      component_instance_id: component_instance_id_ref.current,
      failure_type,
      ...details,
    }
    void send_ocr_debug("OCR_SCAN_FAILED", payload)
    void send_ocr_debug("OCR_PAGE_RELOAD_BLOCKED", payload)
    void send_ocr_debug("OCR_ENTRY_REFRESH_SKIPPED_ON_FAILURE", payload)
  }, [handle_ocr_flow_event])

  async function save_driver_readiness_answer(input: {
    next_image_url: string
    next_form: LicenseFormFields
  }) {
    if (isSubmitting) {
      return false
    }

    if (!input.next_image_url.trim()) {
      setMessage("免許証画像を登録してください。")
      return false
    }

    if (!form_is_complete(input.next_form)) {
      setMessage("確認フォームの必須項目を入力してください。")
      return false
    }

    setIsSubmitting(true)
    setMessage(null)

    try {
      const response = await fetch("/api/driver/license", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image_url: input.next_image_url,
          ...input.next_form,
        }),
      })
      const result = (await response.json().catch(() => null)) as
        | { ok?: boolean; message?: string; state?: unknown }
        | null

      if (!response.ok || result?.ok !== true) {
        setMessage(result?.message ?? "保存できませんでした。")
        report_scan_failure("save_failed", {
          message: result?.message ?? "save_failed",
        })
        return false
      }

      void send_ocr_debug("OCR_SAVE_COMPLETED", {
        document_type: "driver_license_front",
        component_instance_id: component_instance_id_ref.current,
      })
      finish_save(result.state)
      return true
    } catch (error) {
      setMessage("保存できませんでした。")
      report_scan_failure("save_failed", {
        message: error instanceof Error ? error.message : "save_failed",
      })
      return false
    } finally {
      setIsSubmitting(false)
    }
  }

  async function request_ocr(next_image_url: string, source: OcrImageSource) {
    setOcrLoading(true)
    setMessage(null)
    handle_ocr_flow_event("analyze_started")

    try {
      const result = await run_driver_license_ocr_pipeline({
        document_type: "driver_license_front",
        image_url: next_image_url,
        source,
        current_form: form,
      })

      if (!result.ok) {
        report_scan_failure(
          result.pipeline?.stopped_at === "OCR_SAVE_STARTED"
            ? "save_failed"
            : "ocr_unreadable",
          {
            message: result.message,
            pipeline: result.pipeline ?? null,
          },
        )
        return
      }

      handle_ocr_flow_event("fill_started")
      setForm(result.parsed)
      setImageUrl(next_image_url)
      setCapturedPreviewUrl("")
      handle_ocr_flow_event("flow_completed")
      setOcrFailureType(null)
      setMessage(result.message ?? "運転免許証を登録しました。")
      void send_ocr_debug("OCR_FORM_FILL_COMPLETED", {
        document_type: "driver_license_front",
        component_instance_id: component_instance_id_ref.current,
      })
      finish_save(result.state)
    } catch (error) {
      report_scan_failure("ocr_unreadable", {
        message: error instanceof Error ? error.message : "ocr_failed",
      })
    } finally {
      setOcrLoading(false)
    }
  }

  async function handle_capture(input: {
    image_url: string
    source: OcrImageSource
  }) {
    setCapturedPreviewUrl(input.image_url)
    await request_ocr(input.image_url, input.source)
  }

  function begin_retry(source: "camera" | "image_upload") {
    void send_ocr_debug("OCR_RETRY_REQUESTED", {
      document_type: "driver_license_front",
      component_instance_id: component_instance_id_ref.current,
      failure_type: ocr_failure_type,
      source,
    })
    scanner_ref.current?.prepare_retry()
    handle_ocr_flow_event("retry_requested")
    setOcrFailureType(null)
    setMessage(null)
    setOcrLoading(false)
    setShowCameraStart(true)
    camera_started_ref.current = false
  }

  function retry_scan() {
    begin_retry("camera")
    setImageUrl("")
    setCapturedPreviewUrl("")

    window.requestAnimationFrame(() => {
      void scanner_ref.current?.open_from_user_gesture()
    })
  }

  async function handle_failed_image_select(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    try {
      begin_retry("image_upload")
      const next_image_url = await read_file_as_data_url(file)
      await handle_capture({
        image_url: next_image_url,
        source: "image_upload",
      })
    } catch (error) {
      report_scan_failure("capture_failed", {
        message: error instanceof Error ? error.message : "file_read_failed",
      })
    } finally {
      event.target.value = ""
    }
  }

  function start_camera_from_gesture() {
    if (camera_started_ref.current) {
      return
    }

    camera_started_ref.current = true
    set_modal_ocr_state("camera_starting", "camera_starting")
    set_modal_locked(true)
    setShowCameraStart(false)
    mark_license_in_progress()
    void scanner_ref.current?.open_from_user_gesture()
  }

  useEffect(() => {
    const item = get_item("driver_license")

    if (item && !item.complete && item.task_status === "pending") {
      mark_license_in_progress()
    }
  }, [get_item, mark_license_in_progress])

  useImperativeHandle(ref, () => ({
    prepare_modal_close: () => {
      scanner_ref.current?.stop_camera("user_close")
      set_modal_locked(false)
      set_modal_ocr_state("idle", "idle")
      handle_ocr_flow_event("flow_reset")
      setOcrFailureType(null)
      setOcrLoading(false)
      setShowCameraStart(true)
      camera_started_ref.current = false
    },
  }), [handle_ocr_flow_event, set_modal_locked, set_modal_ocr_state])

  const can_save =
    Boolean(image_url.trim()) && form_is_complete(form) && !isSubmitting && !ocr_loading

  const show_completed_preview =
    (ocr_flow_state === "completed" && Boolean(image_url.trim())) ||
    (ocr_flow_state === "idle" &&
      Boolean(image_url.trim()) &&
      !captured_preview_url)

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        {show_camera_start && !scanner_running && ocr_flow_state !== "failed" ? (
          <button
            type="button"
            onClick={start_camera_from_gesture}
            className="h-12 w-full rounded-full bg-neutral-900 text-sm font-bold text-white"
          >
            カメラを起動してスキャン
          </button>
        ) : null}

        <div className={show_completed_preview ? "hidden" : undefined}>
          <DocumentScanner
            ref={scanner_ref}
            component_instance_id={component_instance_id_ref.current}
            document_type="driver_license_front"
            is_active
            is_open
            accordion_locked={is_ocr_accordion_locked(ocr_flow_state)}
            is_locked={is_ocr_accordion_locked(ocr_flow_state)}
            on_capture={handle_capture}
            on_running_change={handle_scanner_running_change}
            flow_state={ocr_flow_state}
            on_flow_event={handle_ocr_flow_event}
            failure_type={ocr_failure_type}
            on_failure={report_scan_failure}
            disabled={isSubmitting || ocr_loading}
            frozen_preview_url={captured_preview_url}
          />
        </div>

        {show_completed_preview ? (
          <div className="relative flex aspect-[3/4] w-full items-center justify-center overflow-hidden rounded-2xl bg-black text-sm text-white/80">
            {preview_url ? (
              <img
                src={preview_url}
                alt="運転免許証プレビュー"
                className="h-full w-full object-contain"
              />
            ) : (
              <span>画像を読み込みました</span>
            )}
            <OcrFlowStatus
              state={ocr_flow_state}
              failure_type={ocr_failure_type}
            />
          </div>
        ) : null}

        {ocr_flow_state === "failed" ? (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={retry_scan}
              className="rounded-full bg-neutral-900 px-3 py-2.5 text-sm font-semibold text-white"
            >
              もう一度スキャン
            </button>
            <label className="inline-flex cursor-pointer items-center justify-center rounded-full border border-neutral-300 px-3 py-2.5 text-sm font-semibold text-neutral-800">
              画像を選択
              <input
                type="file"
                accept="image/*"
                onChange={(event) => void handle_failed_image_select(event)}
                className="sr-only"
              />
            </label>
          </div>
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-neutral-900">確認フォーム</h2>
        <label className="grid gap-1 text-sm text-neutral-700">
          氏名
          <input
            value={form.license_name}
            disabled={!image_url.trim() || ocr_loading}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                license_name: event.target.value,
              }))
            }
            className="h-11 rounded-xl border border-neutral-200 px-3 text-neutral-900 disabled:bg-neutral-50 disabled:text-neutral-400"
          />
        </label>
        <label className="grid gap-1 text-sm text-neutral-700">
          住所
          <input
            value={form.license_address}
            disabled={!image_url.trim() || ocr_loading}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                license_address: event.target.value,
              }))
            }
            className="h-11 rounded-xl border border-neutral-200 px-3 text-neutral-900 disabled:bg-neutral-50 disabled:text-neutral-400"
          />
        </label>
        <label className="grid gap-1 text-sm text-neutral-700">
          生年月日
          <input
            type="date"
            value={form.license_birth_date}
            disabled={!image_url.trim() || ocr_loading}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                license_birth_date: event.target.value,
              }))
            }
            className="h-11 rounded-xl border border-neutral-200 px-3 text-neutral-900 disabled:bg-neutral-50 disabled:text-neutral-400"
          />
        </label>
        <label className="grid gap-1 text-sm text-neutral-700">
          免許証番号
          <input
            value={form.license_number}
            disabled={!image_url.trim() || ocr_loading}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                license_number: event.target.value,
              }))
            }
            className="h-11 rounded-xl border border-neutral-200 px-3 text-neutral-900 disabled:bg-neutral-50 disabled:text-neutral-400"
          />
        </label>
        <label className="grid gap-1 text-sm text-neutral-700">
          有効期限
          <input
            type="date"
            value={form.license_expiration_date}
            disabled={!image_url.trim() || ocr_loading}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                license_expiration_date: event.target.value,
              }))
            }
            className="h-11 rounded-xl border border-neutral-200 px-3 text-neutral-900 disabled:bg-neutral-50 disabled:text-neutral-400"
          />
        </label>
      </section>

      <button
        type="button"
        disabled={!can_save}
        onClick={() => void save_driver_readiness_answer({
          next_image_url: image_url,
          next_form: form,
        })}
        className="h-12 w-full rounded-full bg-neutral-900 text-sm font-bold text-white disabled:opacity-60"
      >
        {isSubmitting ? "保存中..." : "保存する"}
      </button>

      {message ? (
        <p className="rounded-xl bg-neutral-100 px-3 py-3 text-sm font-medium text-neutral-800">
          {message}
        </p>
      ) : null}
    </div>
  )
})

export default DriverLicenseTask
