"use client"

import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from "react"

import DocumentScanner, {
  type DocumentScannerHandle,
  type DocumentScannerStartResult,
} from "@/components/ocr/document_scanner"
import type { DriverProgressEntry } from "@/core/driver/context"
import { build_ocr_status_label } from "@/core/ocr/rules"

type LicenseFormFields = {
  license_name: string
  license_address: string
  license_birth_date: string
  license_number: string
  license_expiration_date: string
}

type OcrResponse = {
  ok?: boolean
  message?: string
  image_url?: string
  parsed?: Partial<LicenseFormFields>
  confidence?: number
  warnings?: string[]
  errors?: Record<string, string>
}

type LicenseSaveResponse = {
  ok?: boolean
  message?: string
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
  start_camera: () => Promise<DocumentScannerStartResult>
}

const DriverLicenseAccordionPanel = forwardRef<
  DriverLicenseAccordionPanelHandle,
  {
    current_answer: string
    initial_entry: DriverProgressEntry | null
    camera_stream?: MediaStream | null
    camera_error?: string | null
    onComplete: () => void
  }
>(function DriverLicenseAccordionPanel(
  {
    current_answer,
    initial_entry,
    camera_stream = null,
    camera_error = null,
    onComplete,
  },
  ref,
) {
  const scanner_ref = useRef<DocumentScannerHandle>(null)
  const [image_url, setImageUrl] = useState(initial_entry?.image_url ?? "")
  const [form, setForm] = useState<LicenseFormFields>(() => form_from_entry(initial_entry))
  const [ocr_loading, setOcrLoading] = useState(false)
  const [ocr_has_result, setOcrHasResult] = useState(
    Boolean(
      initial_entry?.license_name ||
        initial_entry?.license_number ||
        initial_entry?.license_address,
    ),
  )
  const [ocr_warnings, setOcrWarnings] = useState<string[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useImperativeHandle(
    ref,
    () => ({
      start_camera: () =>
        scanner_ref.current?.start_camera() ??
        Promise.resolve({
          started: false,
          stream: null,
          error: "scanner_unavailable",
          error_name: "ScannerUnavailable",
          error_message: "Scanner is unavailable",
        }),
    }),
    [],
  )

  const preview_url = useMemo(() => {
    if (!image_url.startsWith("data:")) {
      return null
    }

    return image_url
  }, [image_url])

  const ocr_status = build_ocr_status_label({
    has_image: Boolean(image_url),
    has_result: ocr_has_result,
    is_loading: ocr_loading,
    warnings: ocr_warnings,
  })

  async function request_ocr(next_image_url: string) {
    setOcrLoading(true)
    setMessage(null)
    setOcrWarnings([])

    try {
      const response = await fetch("/api/ocr", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          document_type: "driver_license_front",
          image_url: next_image_url,
        }),
      })
      const result = (await response.json().catch(() => null)) as OcrResponse | null

      if (!response.ok || result?.ok !== true) {
        setOcrHasResult(false)
        setMessage(result?.message ?? "OCR読み込みに失敗しました。手入力してください。")
        return
      }

      const parsed = result.parsed ?? {}

      setForm((current) => ({
        license_name: parsed.license_name || current.license_name,
        license_address: parsed.license_address || current.license_address,
        license_birth_date: parsed.license_birth_date || current.license_birth_date,
        license_number: parsed.license_number || current.license_number,
        license_expiration_date:
          parsed.license_expiration_date || current.license_expiration_date,
      }))
      setOcrWarnings(result.warnings ?? [])
      setOcrHasResult(
        Boolean(
          parsed.license_name ||
            parsed.license_number ||
            parsed.license_address ||
            (result.confidence ?? 0) > 0,
        ),
      )
    } catch {
      setOcrHasResult(false)
      setMessage("OCR読み込みに失敗しました。手入力してください。")
    } finally {
      setOcrLoading(false)
    }
  }

  function handle_capture(next_image_url: string) {
    setImageUrl(next_image_url)
    setOcrHasResult(false)
    void request_ocr(next_image_url)
  }

  async function submit_license() {
    if (isSubmitting) {
      return
    }

    if (!image_url.trim()) {
      setMessage("免許証画像を登録してください。")
      return
    }

    if (!form_is_complete(form)) {
      setMessage("確認フォームの必須項目を入力してください。")
      return
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
          image_url,
          ...form,
        }),
      })
      const result = (await response.json().catch(() => null)) as
        | LicenseSaveResponse
        | null

      if (!response.ok || result?.ok !== true) {
        setMessage(result?.message ?? "保存できませんでした。")
        return
      }

      setMessage(result.message ?? "運転免許証を登録しました。")
      onComplete()
    } catch {
      setMessage("保存できませんでした。")
    } finally {
      setIsSubmitting(false)
    }
  }

  const can_save =
    Boolean(image_url.trim()) && form_is_complete(form) && !isSubmitting && !ocr_loading

  return (
    <div className="space-y-4 border-t border-neutral-100 px-4 pb-4 pt-3">
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
          preview_url ? (
            <img
              src={preview_url}
              alt="運転免許証プレビュー"
              className="aspect-[3/4] w-full rounded-2xl bg-black object-contain"
            />
          ) : (
            <div className="flex aspect-[3/4] w-full items-center justify-center rounded-2xl bg-black text-sm text-white/80">
              画像を読み込みました
            </div>
          )
        ) : (
          <DocumentScanner
            ref={scanner_ref}
            document_type="driver_license_front"
            on_capture={handle_capture}
            disabled={isSubmitting || ocr_loading}
            camera_stream={camera_stream}
            camera_error={camera_error}
          />
        )}
      </section>

      <section className="space-y-1">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          OCR読み込み結果
        </h4>
        <p className="text-sm leading-6 text-neutral-700">{ocr_status}</p>
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
