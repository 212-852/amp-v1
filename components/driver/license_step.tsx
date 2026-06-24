"use client"

import type { ChangeEvent } from "react"
import { useMemo, useState } from "react"

type LicenseStepPhase = "capture" | "confirm" | "done"

type ParsedLicense = {
  last_name: string
  first_name: string
  license_number: string
  expiry_date: string
}

type LicenseResponse = {
  ok?: boolean
  message?: string
  state?: {
    items: Array<{ key: string; complete: boolean }>
    status: string
    all_complete: boolean
  }
  errors?: Record<string, string>
}

export default function DriverLicenseStep({
  onClose,
  onComplete,
}: Readonly<{
  onClose: () => void
  onComplete: () => void
}>) {
  const [phase, setPhase] = useState<LicenseStepPhase>("capture")
  const [image_url, set_image_url] = useState<string>("")
  const [parsed, set_parsed] = useState<ParsedLicense>({
    last_name: "",
    first_name: "",
    license_number: "",
    expiry_date: "",
  })
  const [message, set_message] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const preview_url = useMemo(() => {
    if (!image_url.startsWith("data:")) {
      return null
    }

    return image_url
  }, [image_url])

  async function handle_capture(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    const reader = new FileReader()

    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : ""

      set_image_url(result)
      setPhase("confirm")
      set_message(null)
    }

    reader.readAsDataURL(file)
  }

  async function submit_license() {
    if (isSubmitting || !image_url) {
      return
    }

    setIsSubmitting(true)
    set_message(null)

    try {
      const response = await fetch("/api/driver/license", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image_url,
          parsed,
        }),
      })
      const result = (await response.json().catch(() => null)) as
        | LicenseResponse
        | null

      if (!response.ok || result?.ok !== true) {
        set_message(result?.message ?? "登録できませんでした。")
        return
      }

      setPhase("done")
      set_message(result.message ?? "運転免許証を登録しました。")
      onComplete()
    } catch {
      set_message("登録できませんでした。")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center">
      <section className="flex max-h-[min(640px,100dvh)] w-full max-w-[430px] flex-col overflow-hidden rounded-3xl bg-white shadow-[0_24px_64px_rgba(0,0,0,0.35)]">
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
          <h3 className="text-base font-bold text-neutral-950">運転免許証</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-semibold text-neutral-500"
          >
            閉じる
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-5 py-4">
          {phase === "capture" ? (
            <label className="grid gap-2 text-sm font-medium text-neutral-700">
              免許証画像を撮影または選択
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handle_capture}
                className="block w-full text-sm"
              />
            </label>
          ) : null}

          {preview_url ? (
            <img
              src={preview_url}
              alt="運転免許証プレビュー"
              className="max-h-48 w-full rounded-xl object-contain ring-1 ring-neutral-200"
            />
          ) : null}

          {phase === "confirm" ? (
            <div className="grid gap-3">
              <p className="text-sm text-neutral-600">
                内容を確認してください。OCR結果は後から修正できます。
              </p>
              <label className="grid gap-1 text-sm">
                姓
                <input
                  value={parsed.last_name}
                  onChange={(event) =>
                    set_parsed((current) => ({
                      ...current,
                      last_name: event.target.value,
                    }))
                  }
                  className="h-11 rounded-xl border border-neutral-200 px-3"
                />
              </label>
              <label className="grid gap-1 text-sm">
                名
                <input
                  value={parsed.first_name}
                  onChange={(event) =>
                    set_parsed((current) => ({
                      ...current,
                      first_name: event.target.value,
                    }))
                  }
                  className="h-11 rounded-xl border border-neutral-200 px-3"
                />
              </label>
              <label className="grid gap-1 text-sm">
                免許証番号
                <input
                  value={parsed.license_number}
                  onChange={(event) =>
                    set_parsed((current) => ({
                      ...current,
                      license_number: event.target.value,
                    }))
                  }
                  className="h-11 rounded-xl border border-neutral-200 px-3"
                />
              </label>
              <label className="grid gap-1 text-sm">
                有効期限
                <input
                  type="date"
                  value={parsed.expiry_date}
                  onChange={(event) =>
                    set_parsed((current) => ({
                      ...current,
                      expiry_date: event.target.value,
                    }))
                  }
                  className="h-11 rounded-xl border border-neutral-200 px-3"
                />
              </label>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => void submit_license()}
                className="mt-2 h-12 rounded-full bg-neutral-900 text-sm font-bold text-white disabled:opacity-60"
              >
                {isSubmitting ? "保存中..." : "登録する"}
              </button>
            </div>
          ) : null}

          {message ? (
            <p className="rounded-xl bg-[#eef9f0] px-3 py-3 text-sm font-medium text-[#1f6b3b]">
              {message}
            </p>
          ) : null}
        </div>
      </section>
    </div>
  )
}
