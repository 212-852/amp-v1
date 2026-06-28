"use client"

import { useEffect, useState, type ChangeEvent } from "react"

import { useDriverPreparation } from "@/components/driver/preparation_provider"
import type { DriverOnboardingTaskKey } from "@/core/driver/context"
import type { DriverProgressKey, DriverProgressState } from "@/core/driver/progress/rules"

type RequiredDocument = {
  item: DriverProgressKey
  status: string
  label: string
}

function read_file(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "")
    reader.onerror = () => reject(new Error("画像を読み込めませんでした。"))
    reader.readAsDataURL(file)
  })
}

export default function DriverDocumentTask({
  task_key,
  documents,
  on_saved,
}: Readonly<{
  task_key: DriverOnboardingTaskKey
  documents: RequiredDocument[]
  on_saved: () => void
}>) {
  const { get_item, update_item } = useDriverPreparation()
  const [files, set_files] = useState<Record<string, string>>({})
  const [saving, set_saving] = useState(false)
  const [message, set_message] = useState<string | null>(null)

  useEffect(() => {
    const item = get_item(task_key)
    if (item && !item.complete && item.task_status !== "in_progress") {
      update_item(task_key, { task_status: "in_progress" })
    }
  }, [get_item, task_key, update_item])

  async function select_file(item: string, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const image = await read_file(file)
      set_files((current) => ({ ...current, [item]: image }))
      set_message(null)
    } catch (error) {
      set_message(error instanceof Error ? error.message : "画像を読み込めませんでした。")
    }
  }

  async function save() {
    if (documents.some((document) => !files[document.item])) {
      set_message("必要な画像をすべて選択してください。")
      return
    }

    set_saving(true)
    set_message(null)
    try {
      let state: DriverProgressState | null = null
      for (const document of documents) {
        const response = await fetch("/api/driver/progress", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            item: document.item,
            status: document.status,
            image_url: files[document.item],
          }),
        })
        const result = (await response.json().catch(() => null)) as {
          ok?: boolean
          message?: string
          state?: DriverProgressState
        } | null
        if (!response.ok || !result?.ok) {
          throw new Error(result?.message ?? "保存できませんでした。")
        }
        state = result.state ?? state
      }

      const item = state?.items.find((candidate) => candidate.key === task_key)
      update_item(task_key, item ?? { complete: true, task_status: "complete" })
      on_saved()
    } catch (error) {
      set_message(error instanceof Error ? error.message : "保存できませんでした。")
    } finally {
      set_saving(false)
    }
  }

  return (
    <div className="space-y-4">
      {documents.map((document) => (
        <label key={document.item} className="grid gap-2 text-sm font-semibold text-neutral-800">
          {document.label}
          <input
            type="file"
            accept="image/*"
            onChange={(event) => void select_file(document.item, event)}
            className="block w-full rounded-xl border border-neutral-200 p-3 text-sm"
          />
        </label>
      ))}
      <button
        type="button"
        disabled={saving}
        onClick={() => void save()}
        className="h-12 w-full rounded-full bg-neutral-900 text-sm font-bold text-white disabled:opacity-60"
      >
        {saving ? "保存中..." : "保存する"}
      </button>
      {message ? <p className="text-sm font-medium text-red-600">{message}</p> : null}
    </div>
  )
}
