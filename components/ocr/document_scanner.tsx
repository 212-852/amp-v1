"use client"

import type { ChangeEvent } from "react"
import { useCallback, useEffect, useRef, useState } from "react"

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
  OCR_AUTO_SCAN_TIMEOUT_MS,
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
  auto_start = true,
}: Readonly<DocumentScannerProps>) {
  const container_ref = useRef<HTMLDivElement>(null)
  const video_ref = useRef<HTMLVideoElement>(null)
  const stream_ref = useRef<MediaStream | null>(null)
  const stable_since_ref = useRef<number | null>(null)
  const captured_ref = useRef(false)

  const [camera_active, setCameraActive] = useState(false)
  const [fallback_mode, setFallbackMode] = useState(false)
  const [fallback_message, setFallbackMessage] = useState<string | null>(null)
  const [frame, setFrame] = useState<FrameRect>({ x: 0, y: 0, width: 0, height: 0 })
  const [quality, setQuality] = useState<FrameQualityResult | null>(null)

  const stop_camera = useCallback(() => {
    stream_ref.current?.getTracks().forEach((track) => track.stop())
    stream_ref.current = null
    setCameraActive(false)
  }, [])

  const enter_fallback = useCallback(
    (message: string) => {
      stop_camera()
      setFallbackMode(true)
      setFallbackMessage(message)
    },
    [stop_camera],
  )

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
    if (!camera_active || disabled || captured_ref.current || fallback_mode) {
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
  }, [camera_active, disabled, fallback_mode, frame, on_capture, stop_camera])

  useEffect(() => {
    if (!camera_active || captured_ref.current || fallback_mode) {
      return
    }

    const timer = window.setTimeout(() => {
      if (captured_ref.current) {
        return
      }

      enter_fallback("自動スキャンできませんでした。画像を選択してください。")
    }, OCR_AUTO_SCAN_TIMEOUT_MS)

    return () => window.clearTimeout(timer)
  }, [camera_active, enter_fallback, fallback_mode])

  const start_camera = useCallback(async () => {
    if (disabled || captured_ref.current) {
      return
    }

    setFallbackMode(false)
    setFallbackMessage(null)
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
      enter_fallback("カメラを使用できません。画像を選択してください。")
    }
  }, [disabled, enter_fallback])

  useEffect(() => {
    if (!auto_start || disabled || fallback_mode || captured_ref.current) {
      return
    }

    void start_camera()
  }, [auto_start, disabled, fallback_mode, start_camera])

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

  const guidance = quality?.guidance_message ?? "枠内に合わせてください"

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
            camera_active ? "opacity-100" : "opacity-0"
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

      {fallback_mode ? (
        <div className="space-y-2">
          {fallback_message ? (
            <p className="text-sm leading-6 text-neutral-600">{fallback_message}</p>
          ) : null}
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
      ) : null}
    </div>
  )
}
