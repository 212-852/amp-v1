"use client"

import { Copy, X } from "lucide-react"
import type { ChangeEvent } from "react"
import { useEffect, useState } from "react"

import { useToast } from "@/components/ui/use_toast"
import {
  build_line_login_url,
  DRIVER_PAGE_FALLBACK_URL,
  resolve_driver_page_url,
} from "@/core/ocr/browser"

const LINE_BROWSER_STEPS = [
  "下のURLをコピーしてください。",
  "Chrome または Safari を開いてください。",
  "検索バーにURLを貼り付けて開いてください。",
  "開いた画面で「LINEで連携」を押してください。",
  "連携後、免許証スキャンをもう一度開いてください。",
] as const

const IMAGE_UPLOAD_BUTTON_CLASS =
  "mx-auto flex w-[80%] cursor-pointer items-center justify-center rounded-2xl border border-neutral-300 bg-white px-4 py-4 text-base font-bold text-neutral-900 shadow-sm transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"

type OcrCameraFallbackProps = {
  disabled?: boolean
  line_linked?: boolean
  show_browser_instructions?: boolean
  reason?: "line_in_app" | "permission_denied" | "unavailable"
  on_file_select: (file: File) => void | Promise<void>
}

export default function OcrCameraFallback({
  disabled = false,
  line_linked = false,
  show_browser_instructions = false,
  reason = show_browser_instructions ? "line_in_app" : "unavailable",
  on_file_select,
}: Readonly<OcrCameraFallbackProps>) {
  const { toast } = useToast()
  const [driver_url, setDriverUrl] = useState(DRIVER_PAGE_FALLBACK_URL)

  useEffect(() => {
    setDriverUrl(resolve_driver_page_url())
  }, [])

  async function handle_copy_url() {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("clipboard_unavailable")
      }

      await navigator.clipboard.writeText(driver_url)
      toast({
        message: "URLをコピーしました",
        tone: "success",
        placement: "center",
      })
    } catch {
      toast({
        message: "URLを長押ししてコピーしてください",
        tone: "error",
        placement: "center",
      })
    }
  }

  function handle_line_link() {
    window.location.href = build_line_login_url("/driver")
  }

  async function handle_file_change(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    await on_file_select(file)
    event.target.value = ""
  }

  const is_line_browser = reason === "line_in_app" || show_browser_instructions

  return (
    <div className="space-y-4 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-5">
      {is_line_browser ? (
        <div className="space-y-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-red-900">LINEブラウザ</span>
            <X className="h-4 w-4 text-red-600" aria-hidden="true" />
          </div>
          <p className="text-base font-bold text-red-900">カメラは使えません</p>
          <p className="text-sm leading-6 text-red-800">画像を選択してください</p>
        </div>
      ) : (
        <div className="space-y-2">
          <h3 className="text-base font-bold text-neutral-900">
            {reason === "permission_denied"
              ? "カメラの許可が必要です"
              : "免許証画像を選択してください"}
          </h3>
          <p className="text-sm leading-6 text-neutral-700">
            {reason === "permission_denied"
              ? "カメラの使用が許可されていません。ブラウザの設定でカメラを許可するか、画像を選択してください。"
              : "カメラを使用できません。画像を選択してください。"}
          </p>
        </div>
      )}

      <label className={IMAGE_UPLOAD_BUTTON_CLASS}>
        画像を選択
        <input
          type="file"
          accept="image/*"
          disabled={disabled}
          onChange={(event) => void handle_file_change(event)}
          className="sr-only"
        />
      </label>

      {show_browser_instructions ? (
        <section className="space-y-4 rounded-2xl border border-neutral-200 bg-white px-4 py-4">
          <h4 className="text-sm font-bold text-neutral-900">ブラウザで開く手順</h4>

          <ol className="list-decimal space-y-2 pl-5 text-sm leading-6 text-neutral-800">
            {LINE_BROWSER_STEPS.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-neutral-500">現在のURL</p>
            <div className="flex items-stretch gap-2">
              <input
                readOnly
                value={driver_url}
                aria-label="ドライバー画面のURL"
                className="min-w-0 flex-1 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-900"
              />
              <button
                type="button"
                disabled={disabled}
                onClick={() => void handle_copy_url()}
                aria-label="URLをコピー"
                className="inline-flex shrink-0 items-center justify-center rounded-xl border border-neutral-200 bg-white px-3 text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-60"
              >
                <Copy className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={disabled}
              onClick={() => void handle_copy_url()}
              className="inline-flex items-center justify-center rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-50 disabled:opacity-60"
            >
              URLをコピー
            </button>
            {line_linked ? (
              <span className="inline-flex items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800">
                LINE連携済み
              </span>
            ) : (
              <button
                type="button"
                disabled={disabled}
                onClick={handle_line_link}
                className="inline-flex items-center justify-center rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-50 disabled:opacity-60"
              >
                LINEで連携する
              </button>
            )}
          </div>
        </section>
      ) : null}
    </div>
  )
}
