"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"

import FormField from "@/components/form/field"
import Scanner, {
  type OcrScannerHandle,
  type ScannerState,
} from "@/components/ocr/scanner"
import { useDriverPreparation } from "@/components/driver/preparation_provider"
import type { DriverProgressState } from "@/core/driver/progress/rules"
import { send_ocr_debug } from "@/core/ocr/debug"
import {
  normalize_number,
  normalize_text,
  normalize_textarea,
} from "@/form/normalize"

type LicenseForm = {
  name: string
  address: string
  birth_date: string
  license_number: string
  expiration_date: string
}

const EMPTY_FORM: LicenseForm = {
  name: "",
  address: "",
  birth_date: "",
  license_number: "",
  expiration_date: "",
}

const FIELD_CLASS =
  "h-11 rounded-xl border border-neutral-200 px-3 text-neutral-900 disabled:bg-neutral-50 disabled:text-neutral-400"

function status_text(state: ScannerState) {
  if (state === "analyzing") return "文字を解析しています"
  if (state === "filling_form") return "フォームへ入力しています"
  if (state === "completed") return "入力が完了しました"
  if (state === "failed") return "読み取りできませんでした"
  return null
}

export default function DriverLicenseTask({
  request_id,
  component_instance_id,
  on_saved,
}: Readonly<{
  request_id: string
  component_instance_id: string
  on_saved: () => void
}>) {
  const { get_item, update_item } = useDriverPreparation()
  const scanner_ref = useRef<OcrScannerHandle>(null)
  const request_abort_ref = useRef<AbortController | null>(null)
  const scan_state_ref = useRef<ScannerState>("camera_starting")
  const [scan_state, set_scan_state] = useState<ScannerState>("camera_starting")
  const [form, set_form] = useState<LicenseForm>(EMPTY_FORM)
  const [errors, set_errors] = useState<Record<string, string>>({})
  const [message, set_message] = useState<string | null>(null)

  const debug = useCallback((event: Parameters<typeof send_ocr_debug>[0], extra: Record<string, unknown> = {}) => {
    void send_ocr_debug(event, {
      request_id,
      component_instance_id,
      document_type: "driver_license_front",
      scan_state: scan_state_ref.current,
      camera_state:
        scan_state_ref.current === "camera_starting" ? "starting" :
        scan_state_ref.current === "camera_ready" || scan_state_ref.current === "detecting" ? "playing" :
        scan_state_ref.current === "failed" ? "failed" : "captured",
      ...extra,
    })
  }, [component_instance_id, request_id])

  useLayoutEffect(() => {
    void send_ocr_debug("DRIVER_TASK_MODAL_BODY_RENDER", {
      request_id,
      component_instance_id,
      document_type: "driver_license_front",
      scan_state: "camera_starting",
      camera_state: "starting",
      task_key: "driver_license",
    })
  }, [component_instance_id, request_id])

  useEffect(() => {
    const item = get_item("driver_license")
    if (item && !item.complete && item.task_status !== "in_progress") {
      update_item("driver_license", { task_status: "in_progress" })
    }
  }, [get_item, update_item])

  useEffect(() => {
    return () => request_abort_ref.current?.abort()
  }, [])

  const update_scan_state = useCallback((state: ScannerState) => {
    scan_state_ref.current = state
    set_scan_state(state)
  }, [])

  const apply_progress_state = useCallback((state: unknown) => {
    const progress = state as DriverProgressState | undefined
    const item = progress?.items?.find((candidate) => candidate.key === "driver_license")
    update_item("driver_license", item ?? {
      complete: true,
      task_status: "complete",
    })
  }, [update_item])

  const handle_capture = useCallback(async (image_base64: string) => {
    request_abort_ref.current?.abort()
    const controller = new AbortController()
    request_abort_ref.current = controller
    update_scan_state("analyzing")
    set_message(null)
    set_errors({})
    debug("OCR_ANALYZE_STARTED")

    try {
      const response = await fetch("/api/driver/license/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          request_id,
          component_instance_id,
          document_type: "driver_license_front",
          image_base64,
        }),
      })
      const result = (await response.json().catch(() => null)) as {
        ok?: boolean
        message?: string
        fields?: Record<string, string>
        errors?: Record<string, string>
        state?: unknown
      } | null

      if (controller.signal.aborted) return

      if (!response.ok || !result?.ok) {
        set_errors(result?.errors ?? {})
        set_message(result?.message ?? "読み取りできませんでした")
        update_scan_state("failed")
        return
      }

      debug("OCR_FORM_MAP_COMPLETED")
      update_scan_state("filling_form")
      debug("OCR_FORM_FILL_STARTED")
      const fields = result.fields ?? {}
      const next_form: LicenseForm = {
        name: normalize_text(fields.name),
        address: normalize_textarea(fields.address),
        birth_date: normalize_text(fields.birth_date),
        license_number: normalize_number(fields.license_number),
        expiration_date: normalize_text(fields.expiration_date),
      }
      set_form(next_form)
      debug("OCR_FORM_FILL_COMPLETED")

      debug("OCR_SAVE_STARTED")
      const save_response = await fetch("/api/driver/license", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          image_url: image_base64,
          license_name: next_form.name,
          license_address: next_form.address,
          license_birth_date: next_form.birth_date,
          license_number: next_form.license_number,
          license_expiration_date: next_form.expiration_date,
        }),
      })
      const save_result = (await save_response.json().catch(() => null)) as {
        ok?: boolean
        message?: string
        state?: unknown
      } | null

      if (controller.signal.aborted) return

      if (!save_response.ok || !save_result?.ok) {
        set_message(save_result?.message ?? "保存できませんでした。")
        update_scan_state("failed")
        return
      }

      debug("OCR_SAVE_COMPLETED")
      apply_progress_state(save_result.state)
      update_scan_state("completed")
      on_saved()
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return
      set_message(error instanceof Error ? error.message : "読み取りできませんでした")
      update_scan_state("failed")
    }
  }, [
    apply_progress_state,
    component_instance_id,
    debug,
    on_saved,
    request_id,
    update_scan_state,
  ])

  const retry = useCallback(() => {
    request_abort_ref.current?.abort()
    request_abort_ref.current = null
    set_message(null)
    set_errors({})
    update_scan_state("camera_starting")
    scanner_ref.current?.retry()
  }, [update_scan_state])

  const detail_status = status_text(scan_state)

  return (
    <div className="space-y-6">
      <Scanner
        ref={scanner_ref}
        request_id={request_id}
        component_instance_id={component_instance_id}
        document_type="driver_license_front"
        scan_state={scan_state}
        on_scan_state={update_scan_state}
        on_capture={handle_capture}
        on_failure={set_message}
      />

      {detail_status ? (
        <p className="rounded-xl bg-neutral-100 px-3 py-3 text-sm font-medium text-neutral-800">
          {detail_status}
        </p>
      ) : null}

      {scan_state === "failed" ? (
        <button type="button" onClick={retry} className="h-11 w-full rounded-full bg-neutral-900 text-sm font-semibold text-white">
          もう一度スキャン
        </button>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-neutral-900">確認フォーム</h2>
        <FormField label="氏名" error={errors.name} baseFieldClass={FIELD_CLASS}>
          {(className) => <input value={form.name} readOnly className={className} />}
        </FormField>
        <FormField label="住所" error={errors.address} baseFieldClass={FIELD_CLASS}>
          {(className) => <input value={form.address} readOnly className={className} />}
        </FormField>
        <FormField label="生年月日" error={errors.birth_date} baseFieldClass={FIELD_CLASS}>
          {(className) => <input type="date" value={form.birth_date} readOnly className={className} />}
        </FormField>
        <FormField label="免許証番号" error={errors.license_number} baseFieldClass={FIELD_CLASS}>
          {(className) => <input inputMode="numeric" value={form.license_number} readOnly className={className} />}
        </FormField>
        <FormField label="有効期限" error={errors.expiration_date} baseFieldClass={FIELD_CLASS}>
          {(className) => <input type="date" value={form.expiration_date} readOnly className={className} />}
        </FormField>
      </section>

      {message ? (
        <p className="rounded-xl bg-neutral-100 px-3 py-3 text-sm font-medium text-neutral-800">{message}</p>
      ) : null}
    </div>
  )
}
