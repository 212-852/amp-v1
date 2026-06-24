"use client"

import type { ChangeEvent } from "react"
import { useEffect, useRef, useState } from "react"

import {
  capture_video_frame,
  read_file_as_data_url,
  resolve_scanner_frame,
  sample_video_frame_quality,
  type FrameQualityResult,
  type FrameRect,
} from "@/core/ocr/camera"
import {
  OCR_AUTO_CAPTURE_STABLE_MS,
  type OcrDocumentType,
} from "@/core/ocr/rules"

type DocumentScannerProps = {
  document_type: OcrDocumentType
  on_capture: (image_url: string) => void
  disabled?: boolean
  auto_start?: boolean
}

export default function DocumentScanner({
  document_type,
  on_capture,
  disabled = false,
  auto_start = false,
}: Readonly<DocumentScannerProps>) {
  const container_ref = useRef<HTMLDivElement>(null)
  const video_ref = useRef<HTMLVideoElement>(null)
  const stream_ref = useRef<MediaStream | null>(null)
  const stable_since_ref = useRef<number | null>(null)
  const captured_ref = useRef(false)

  const [camera_active, setCameraActive] = useState(false)
  const [camera_error, setCameraError] = useState<string | null>(null)
  const [frame, setFrame] = useState<FrameRect>({ x: 0, y: 0, width: 0, height: 0 })
  const [quality, setQuality] = useState<FrameQualityResult | null>(null)

  useEffect(() => {
    function update_frame() {
      const container = container_ref.current

      if (!container) {
        return
      }

      const rect = container.getBoundingClientRect()

      setFrame(
        resolve_scanner_frame(document_type, rect.width, rect.height),
      )
    }

    update_frame()
    window.addEventListener("resize", update_frame)

    return () => window.removeEventListener("resize", update_frame)
  }, [document_type])

  useEffect(() => {
    return () => {
      stream_ref.current?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  useEffect(() => {
    if (!camera_active || disabled || captured_ref.current) {
      return
    }

    let animation_id = 0

    const tick = () => {
      const video = video_ref.current

      if (video && video.readyState >= 2 && frame.width > 0) {
        const next_quality = sample_video_frame_quality({ video, frame })
        setQuality(next_quality)

        if (next_quality.ready) {
          if (stable_since_ref.current == null) {
            stable_since_ref.current = performance.now()
          } else if (
            performance.now() - stable_since_ref.current >=
            OCR_AUTO_CAPTURE_STABLE_MS
          ) {
            captured_ref.current = true
            const image_url = capture_video_frame({ video, frame })
            stop_camera()
            on_capture(image_url)
            return
          }
        } else {
          stable_since_ref.current = null
        }
      }

      animation_id = window.requestAnimationFrame(tick)
    }

    animation_id = window.requestAnimationFrame(tick)

    return () => window.cancelAnimationFrame(animation_id)
  }, [camera_active, disabled, frame, on_capture])

  function stop_camera() {
    stream_ref.current?.getTracks().forEach((track) => track.stop())
    stream_ref.current = null
    setCameraActive(false)
  }

  async function start_camera() {
    setCameraError(null)
    captured_ref.current = false
    stable_since_ref.current = null

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      })

      stream_ref.current = stream
      const video = video_ref.current

      if (video) {
        video.srcObject = stream
        await video.play()
      }

      setCameraActive(true)
    } catch {
      setCameraError("カメラを使用できません。画像を選択してください。")
      setCameraActive(false)
    }
  }

  async function handle_file_select(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    captured_ref.current = true
    stop_camera()

    const image_url = await read_file_as_data_url(file)
    on_capture(image_url)
    event.target.value = ""
  }

  useEffect(() => {
    if (!auto_start || disabled) {
      return
    }

    void start_camera()
  }, [auto_start, disabled])

  const guidance =
    quality?.guidance_message ??
    (camera_active ? "枠内に合わせてください" : "カメラでスキャンを開始してください")

  return (
    <div className="space-y-3">
      <div
        ref={container_ref}
        className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-black"
      >
        <video
          ref={video_ref}
          playsInline
          muted
          className={`absolute inset-0 h-full w-full object-cover ${
            camera_active ? "opacity-100" : "opacity-30"
          }`}
        />

        {!camera_active ? (
          <div className="absolute inset-0 bg-black" aria-hidden="true" />
        ) : null}

        {frame.width > 0 ? (
          <div
            className="pointer-events-none absolute rounded-xl border-2 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]"
            style={{
              left: frame.x,
              top: frame.y,
              width: frame.width,
              height: frame.height,
            }}
          />
        ) : null}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-4 pb-4 pt-10">
          <p className="text-center text-sm font-medium leading-6 text-white">
            {guidance}
          </p>
        </div>
      </div>

      {camera_error ? (
        <p className="text-sm leading-6 text-neutral-600">{camera_error}</p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled || camera_active}
          onClick={() => void start_camera()}
          className="inline-flex items-center justify-center rounded-full border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-50 disabled:opacity-60"
        >
          カメラでスキャン
        </button>
        <label className="inline-flex cursor-pointer items-center justify-center rounded-full border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-50">
          画像を選択
          <input
            type="file"
            accept="image/*"
            disabled={disabled}
            onChange={(event) => void handle_file_select(event)}
            className="sr-only"
          />
        </label>
      </div>
    </div>
  )
}
