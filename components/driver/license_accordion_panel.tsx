"use client"

import type { ChangeEvent } from "react"
import { useMemo, useState } from "react"

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
  fields?: Partial<LicenseFormFields>
  errors?: Record<string, string>
}

type LicenseSaveResponse = {
  ok?: boolean
  message?: string
  state?: {
    items: Array<{ key: string; complete: boolean }>
    status: string
    all_complete: boolean
  }
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

export default function DriverLicenseAccordionPanel({
  current_answer,
  initial_entry,
  onComplete,
}: Readonly<{
  current_answer: string
  initial_entry: DriverProgressEntry | null
  onComplete: () => void
}>) {
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
  const [message, setMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

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
  })

  async function run_ocr(next_image_url: string) {
    setOcrLoading(true)
    setMessage(null)

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

      if (!response.ok || result?.ok !== true || !result.fields) {
        setOcrHasResult(false)
        setMessage(result?.message ?? "OCR読み込みに失敗しました。手入力してください。")
        return
      }

      setForm((current) => ({
        license_name: result.fields?.license_name || current.license_name,
        license_address: result.fields?.license_address || current.license_address,
        license_birth_date:
          result.fields?.license_birth_date || current.license_birth_date,
        license_number: result.fields?.license_number || current.license_number,
        license_expiration_date:
          result.fields?.license_expiration_date || current.license_expiration_date,
      }))
      setOcrHasResult(
        Boolean(
          result.fields.license_name ||
            result.fields.license_number ||
            result.fields.license_address,
        ),
      )
    } catch {
      setOcrHasResult(false)
      setMessage("OCR読み込みに失敗しました。手入力してください。")
    } finally {
      setOcrLoading(false)
    }
  }

  async function handle_image_select(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    const reader = new FileReader()

    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : ""

      setImageUrl(result)
      setOcrHasResult(false)
      void run_ocr(result)
    }

    reader.readAsDataURL(file)
    event.target.value = ""
  }

  async function submit_license() {
    if (isSubmitting || !image_url.trim()) {
      setMessage("免許証画像を登録してください。")
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
          免許証画像
        </h4>
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex cursor-pointer items-center justify-center rounded-full border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-50">
            免許証の表面をスキャン
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handle_image_select}
              className="sr-only"
            />
          </label>
          <label className="inline-flex cursor-pointer items-center justify-center rounded-full border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-50">
            画像を選択
            <input
              type="file"
              accept="image/*"
              onChange={handle_image_select}
              className="sr-only"
            />
          </label>
        </div>
        {preview_url ? (
          <img
            src={preview_url}
            alt="運転免許証プレビュー"
            className="max-h-40 w-full rounded-xl object-contain ring-1 ring-neutral-200"
          />
        ) : null}
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
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                license_name: event.target.value,
              }))
            }
            className="h-11 rounded-xl border border-neutral-200 px-3 text-neutral-900"
          />
        </label>
        <label className="grid gap-1 text-sm text-neutral-700">
          住所
          <input
            value={form.license_address}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                license_address: event.target.value,
              }))
            }
            className="h-11 rounded-xl border border-neutral-200 px-3 text-neutral-900"
          />
        </label>
        <label className="grid gap-1 text-sm text-neutral-700">
          生年月日
          <input
            type="date"
            value={form.license_birth_date}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                license_birth_date: event.target.value,
              }))
            }
            className="h-11 rounded-xl border border-neutral-200 px-3 text-neutral-900"
          />
        </label>
        <label className="grid gap-1 text-sm text-neutral-700">
          免許証番号
          <input
            value={form.license_number}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                license_number: event.target.value,
              }))
            }
            className="h-11 rounded-xl border border-neutral-200 px-3 text-neutral-900"
          />
        </label>
        <label className="grid gap-1 text-sm text-neutral-700">
          有効期限
          <input
            type="date"
            value={form.license_expiration_date}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                license_expiration_date: event.target.value,
              }))
            }
            className="h-11 rounded-xl border border-neutral-200 px-3 text-neutral-900"
          />
        </label>
      </section>

      <button
        type="button"
        disabled={isSubmitting || !image_url.trim()}
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
}
