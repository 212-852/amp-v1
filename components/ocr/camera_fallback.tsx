"use client"

import type { ChangeEvent } from "react"
import { useState } from "react"

import { open_current_url_in_external_browser } from "@/core/ocr/browser"

type OcrCameraFallbackProps = {
  disabled?: boolean
  on_file_select: (file: File) => void | Promise<void>
  show_line_guidance?: boolean
}

export default function OcrCameraFallback({
  disabled = false,
  on_file_select,
  show_line_guidance = true,
}: Readonly<OcrCameraFallbackProps>) {
  const [external_browser_hint, setExternalBrowserHint] = useState(false)

  function handle_open_external_browser() {
    const result = open_current_url_in_external_browser()

    if (!result.opened) {
      setExternalBrowserHint(true)
    }
  }

  async function handle_file_change(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    await on_file_select(file)
    event.target.value = ""
  }

  return (
    <div className="space-y-4 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-5">
      <div className="space-y-2">
        <h3 className="text-base font-bold text-neutral-900">
          カメラを起動できませんでした
        </h3>
        {show_line_guidance ? (
          <p className="text-sm leading-6 text-neutral-700">
            LINEアプリ内ブラウザではカメラが許可されない場合があります。
            画像を選択するか、外部ブラウザで開いてください。
          </p>
        ) : (
          <p className="text-sm leading-6 text-neutral-700">
            カメラの使用が許可されていません。画像を選択するか、外部ブラウザで開いてください。
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <label className="inline-flex cursor-pointer items-center justify-center rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-50">
          画像を選択
          <input
            type="file"
            accept="image/*"
            disabled={disabled}
            onChange={(event) => void handle_file_change(event)}
            className="sr-only"
          />
        </label>
        <button
          type="button"
          disabled={disabled}
          onClick={handle_open_external_browser}
          className="inline-flex items-center justify-center rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-50 disabled:opacity-60"
        >
          外部ブラウザで開く
        </button>
      </div>

      {external_browser_hint ? (
        <p className="text-sm leading-6 text-neutral-600">
          右上メニューから「ブラウザで開く」を選択してください。
        </p>
      ) : null}
    </div>
  )
}
