"use client"

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react"

import DocumentScanner, {
  type DocumentScannerHandle,
  type DocumentScannerStartResult,
} from "@/components/ocr/document_scanner"
import OcrFlowStatus from "@/components/ocr/flow_status"
import type { DriverProgressEntry } from "@/core/driver/context"
import {
  apply_ocr_to_license_form,
  has_ocr_license_result,
  read_driver_license_image,
  type OcrImageSource,
} from "@/core/ocr/client"
import {
  reduce_ocr_flow,
  type OcrFlowEvent,
} from "@/core/ocr/flow"

type LicenseFormFields = {
  license_name: string
  license_address: string
  license_birth_date: string
  license_number: string
  license_expiration_date: string
}

type LicenseSaveResponse = {
  ok?: boolean
  message?: string
  state?: unknown
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

export type DriverLicenseAccordionPanelHandle = {
  open_from_user_gesture: () => Promise<DocumentScannerStartResult>
  start_camera: () => Promise<DocumentScannerStartResult>
  stop_camera: () => void
}

const DriverLicenseAccordionPanel = forwardRef<
  DriverLicenseAccordionPanelHandle,
  {
    current_answer: string
    initial_entry: DriverProgressEntry | null
    on_ocr_running_change?: (running: boolean) => void
    onComplete: () => void
  }
>(function DriverLicenseAccordionPanel(
  {
    current_answer,
    initial_entry,
    on_ocr_running_change,
    onComplete,
  },
  ref,
) {
  const scanner_ref = useRef<DocumentScannerHandle>(null)
  const [ocr_flow_state, dispatch_ocr_flow] = useReducer(
    reduce_ocr_flow,
    "idle",
  )
  const [image_url, setImageUrl] = useState(initial_entry?.image_url ?? "")
  const [form, setForm] = useState<LicenseFormFields>(() => form_from_entry(initial_entry))
  const [scanner_running, setScannerRunning] = useState(false)
  const [ocr_loading, setOcrLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useImperativeHandle(
    ref,
    () => ({
      open_from_user_gesture: () =>
        scanner_ref.current?.open_from_user_gesture() ??
        Promise.resolve({
          started: false,
          stream: null,
          error: "scanner_unavailable",
          error_name: "ScannerUnavailable",
          error_message: "Scanner is unavailable",
          error_kind: "failed",
        }),
      start_camera: () =>
        scanner_ref.current?.start_camera() ??
        Promise.resolve({
          started: false,
          stream: null,
          error: "scanner_unavailable",
          error_name: "ScannerUnavailable",
          error_message: "Scanner is unavailable",
          error_kind: "failed",
        }),
      stop_camera: () => scanner_ref.current?.stop_camera(),
    }),
    [],
  )

  useEffect(() => {
    on_ocr_running_change?.(scanner_running || ocr_loading)
  }, [ocr_loading, on_ocr_running_change, scanner_running])

  const preview_url = useMemo(() => {
    if (!image_url.startsWith("data:")) {
      return null
    }

    return image_url
  }, [image_url])

  const handle_scanner_running_change = useCallback((running: boolean) => {
    setScannerRunning(running)
  }, [])

  const handle_ocr_flow_event = useCallback((event: OcrFlowEvent) => {
    dispatch_ocr_flow(event)
  }, [])

  async function save_license(input: {
    next_image_url: string
    next_form: LicenseFormFields
  }) {
    if (isSubmitting) {
      return
    }

    if (!input.next_image_url.trim()) {
      setMessage("免許証画像を登録してください。")
      return
    }

    if (!form_is_complete(input.next_form)) {
      setMessage("確認フォームの必須項目を入力してください。")
      return
    }

    setIsSubmitting(true)
    setMessage(null)

    try {
      const saved_answer_payload = {
        image_url: input.next_image_url,
        ...input.next_form,
      }

      console.log("[OCR_FLOW] progress_update", {
        phase: "before_save",
        progress_before: {
          current_answer,
          latest_entry: initial_entry,
        },
        saved_answer_payload,
      })

      const response = await fetch("/api/driver/license", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(saved_answer_payload),
      })
      const result = (await response.json().catch(() => null)) as
        | LicenseSaveResponse
        | null

      if (!response.ok || result?.ok !== true) {
        setMessage(result?.message ?? "保存できませんでした。")
        return
      }

      console.log("[OCR_FLOW] progress_update", {
        phase: "after_save",
        progress_before: {
          current_answer,
          latest_entry: initial_entry,
        },
        progress_after: result.state ?? null,
        saved_answer_payload,
      })
      console.log("[OCR_FLOW] completed", {
        document_type: "driver_license_front",
      })
      setMessage(result.message ?? "運転免許証を登録しました。")
      onComplete()
    } catch {
      setMessage("保存できませんでした。")
    } finally {
      setIsSubmitting(false)
    }
  }

  async function request_ocr(next_image_url: string, source: OcrImageSource) {
    setScannerRunning(false)
    setOcrLoading(true)
    setMessage(null)
    dispatch_ocr_flow("analyze_started")
    console.log("[OCR_FLOW] analyze_start", {
      document_type: "driver_license_front",
      source,
    })

    try {
      const result = await read_driver_license_image({
        document_type: "driver_license_front",
        image_url: next_image_url,
        source,
      })

      if (!result.ok) {
        setMessage(result.message)
        dispatch_ocr_flow("flow_failed")
        return
      }

      console.log("[OCR_FLOW] analyze_success", {
        document_type: "driver_license_front",
        parsed_ocr_result: result.parsed,
        confidence: result.confidence,
        warnings: result.warnings,
      })

      dispatch_ocr_flow("fill_started")
      const next_form = apply_ocr_to_license_form({
        current: form,
        parsed: result.parsed,
      })

      const has_result = has_ocr_license_result({
        parsed: result.parsed,
        confidence: result.confidence,
      })

      setForm(next_form)

      dispatch_ocr_flow(has_result ? "flow_completed" : "flow_failed")

      if (result.saved) {
        console.log("[OCR_FLOW] progress_update", {
          phase: "client_received_saved_state",
          progress_before: {
            current_answer,
            latest_entry: initial_entry,
          },
          progress_after: result.state ?? null,
          saved_answer_payload: {
            image_url: next_image_url,
            ...next_form,
          },
        })
        console.log("[OCR_FLOW] completed", {
          document_type: "driver_license_front",
        })
        setMessage(result.message)
        onComplete()
      }
    } catch (error) {
      dispatch_ocr_flow("flow_failed")
      setMessage(
        error instanceof Error
          ? error.message
          : "OCR読み込みに失敗しました。",
      )
    } finally {
      setOcrLoading(false)
    }
  }

  async function handle_capture(input: {
    image_url: string
    source: OcrImageSource
  }) {
    setScannerRunning(false)
    setImageUrl(input.image_url)
    await request_ocr(input.image_url, input.source)
  }

  async function submit_license() {
    await save_license({
      next_image_url: image_url,
      next_form: form,
    })
  }

  const can_save =
    Boolean(image_url.trim()) && form_is_complete(form) && !isSubmitting && !ocr_loading

  return (
    <div className="space-y-3 border-t border-neutral-100 px-4 pb-4 pt-3">
      <section className="space-y-1">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          現在の回答
        </h4>
        <p className="text-sm leading-6 text-neutral-800">{current_answer}</p>
      </section>

      <section className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          免許証スキャン
        </h4>
        {image_url ? (
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
            <OcrFlowStatus state={ocr_flow_state} />
          </div>
        ) : (
          <DocumentScanner
            ref={scanner_ref}
            document_type="driver_license_front"
            on_capture={handle_capture}
            on_running_change={handle_scanner_running_change}
            flow_state={ocr_flow_state}
            on_flow_event={handle_ocr_flow_event}
            disabled={isSubmitting || ocr_loading}
          />
        )}
      </section>

      <section className="space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          確認フォーム
        </h4>
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
        onClick={() => void submit_license()}
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

export default DriverLicenseAccordionPanel
