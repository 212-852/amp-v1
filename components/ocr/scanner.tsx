"use client"

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react"

import {
  capture_video_frame,
  evaluate_auto_capture_frame,
  resolve_scanner_frame,
  start_auto_scan,
  type FrameRect,
} from "@/core/ocr/camera"
import { send_ocr_debug } from "@/core/ocr/debug"
import { auto_capture_delay_ms } from "@/ocr/rules"
import type { OcrDocumentType } from "@/ocr/type"

export type ScannerState =
  | "camera_starting"
  | "camera_ready"
  | "detecting"
  | "capturing"
  | "analyzing"
  | "filling_form"
  | "completed"
  | "failed"

export type OcrScannerHandle = {
  retry: () => void
  stop: (reason: string) => void
}

type ScannerProps = {
  request_id: string
  component_instance_id: string
  document_type: OcrDocumentType
  scan_state: ScannerState
  on_scan_state: (state: ScannerState) => void
  on_capture: (image_base64: string) => void | Promise<void>
  on_failure: (message: string) => void
}

const EMPTY_FRAME: FrameRect = { x: 0, y: 0, width: 0, height: 0 }

const Scanner = forwardRef<OcrScannerHandle, ScannerProps>(function Scanner(
  {
    request_id,
    component_instance_id,
    document_type,
    scan_state,
    on_scan_state,
    on_capture,
    on_failure,
  },
  ref,
) {
  const container_ref = useRef<HTMLDivElement>(null)
  const video_ref = useRef<HTMLVideoElement>(null)
  const camera_stream_ref = useRef<MediaStream | null>(null)
  const camera_started_ref = useRef(false)
  const capture_started_ref = useRef(false)
  const stop_scan_ref = useRef<(() => void) | null>(null)
  const attempt_ref = useRef(0)
  const lifecycle_generation_ref = useRef(0)
  const mount_logged_ref = useRef(false)
  const camera_state_ref = useRef("idle")
  const scan_state_ref = useRef<ScannerState>(scan_state)
  const auto_state_ref = useRef({
    enabled_at: null as number | null,
    valid_frame_count: 0,
    stable_started_at: null as number | null,
  })
  const [frame, set_frame] = useState<FrameRect>(EMPTY_FRAME)
  const [camera_ready, set_camera_ready] = useState(false)
  const [status, set_status] = useState("免許証を枠内に合わせてください")

  const debug = useCallback((event: Parameters<typeof send_ocr_debug>[0], extra: Record<string, unknown> = {}) => {
    void send_ocr_debug(event, {
      request_id,
      component_instance_id,
      document_type,
      scan_state: scan_state_ref.current,
      camera_state: camera_state_ref.current,
      ...extra,
    })
  }, [component_instance_id, document_type, request_id])

  const update_state = useCallback((state: ScannerState) => {
    scan_state_ref.current = state
    on_scan_state(state)
  }, [on_scan_state])

  const stop_camera = useCallback((reason: string) => {
    attempt_ref.current += 1
    stop_scan_ref.current?.()
    stop_scan_ref.current = null
    camera_stream_ref.current?.getTracks().forEach((track) => track.stop())
    camera_stream_ref.current = null
    if (video_ref.current) video_ref.current.srcObject = null
    camera_state_ref.current = "stopped"
    set_camera_ready(false)
    debug("OCR_CAMERA_STOP", { reason })
  }, [debug])

  const attach_stream = useCallback(async (stream: MediaStream) => {
    const video = video_ref.current
    if (!video) return
    video.srcObject = stream
    video.muted = true
    video.playsInline = true
    await video.play()
    camera_state_ref.current = "playing"
    set_camera_ready(true)
    update_state("camera_ready")
    debug("OCR_CAMERA_PLAYING", {
      video_width: video.videoWidth,
      video_height: video.videoHeight,
    })
  }, [debug, update_state])

  const start_camera = useCallback(async () => {
    if (camera_started_ref.current) {
      if (camera_stream_ref.current) await attach_stream(camera_stream_ref.current)
      return
    }

    camera_started_ref.current = true
    capture_started_ref.current = false
    camera_state_ref.current = "starting"
    update_state("camera_starting")
    debug("OCR_CAMERA_START_REQUESTED")
    const attempt = ++attempt_ref.current

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("カメラを使用できません。")
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      })

      if (attempt !== attempt_ref.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }

      camera_stream_ref.current = stream
      camera_state_ref.current = "stream_received"
      debug("OCR_CAMERA_STREAM_RECEIVED", { track_count: stream.getTracks().length })
      await attach_stream(stream)
    } catch (error) {
      camera_stream_ref.current?.getTracks().forEach((track) => track.stop())
      camera_stream_ref.current = null
      camera_started_ref.current = false
      camera_state_ref.current = "failed"
      update_state("failed")
      on_failure(error instanceof Error ? error.message : "カメラを起動できませんでした。")
    }
  }, [attach_stream, debug, on_failure, update_state])

  const retry = useCallback(() => {
    stop_camera("retry")
    attempt_ref.current += 1
    camera_started_ref.current = false
    capture_started_ref.current = false
    auto_state_ref.current = {
      enabled_at: null,
      valid_frame_count: 0,
      stable_started_at: null,
    }
    set_status("免許証を枠内に合わせてください")
    void start_camera()
  }, [start_camera, stop_camera])

  useImperativeHandle(ref, () => ({ retry, stop: stop_camera }), [retry, stop_camera])

  const is_current_lifecycle = useCallback(
    (generation: number) => lifecycle_generation_ref.current === generation,
    [],
  )

  useEffect(() => {
    scan_state_ref.current = scan_state
  }, [scan_state])

  useEffect(() => {
    const node = container_ref.current
    if (!node) return
    const update = () => {
      const rect = node.getBoundingClientRect()
      set_frame(resolve_scanner_frame(document_type, rect.width, rect.height))
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(node)
    return () => observer.disconnect()
  }, [document_type])

  useEffect(() => {
    const generation = ++lifecycle_generation_ref.current
    if (!mount_logged_ref.current) {
      mount_logged_ref.current = true
      debug("OCR_COMPONENT_MOUNT")
    }
    void start_camera()

    return () => {
      queueMicrotask(() => {
        if (!is_current_lifecycle(generation)) return
        debug("OCR_COMPONENT_UNMOUNT")
        stop_camera("component_unmount")
      })
    }
  }, [debug, is_current_lifecycle, start_camera, stop_camera])

  useEffect(() => {
    const video = video_ref.current
    if (!camera_ready || !video || frame.width <= 0 || capture_started_ref.current) return

    update_state("detecting")
    auto_state_ref.current = {
      enabled_at: performance.now() + auto_capture_delay_ms,
      valid_frame_count: 0,
      stable_started_at: null,
    }

    stop_scan_ref.current = start_auto_scan({
      video,
      frame,
      is_cancelled: () => capture_started_ref.current,
      on_quality: (quality) => {
        const decision = evaluate_auto_capture_frame({
          frame_result: quality,
          now: performance.now(),
          ...auto_state_ref.current,
        })
        auto_state_ref.current = {
          enabled_at: auto_state_ref.current.enabled_at,
          valid_frame_count: decision.valid_frame_count,
          stable_started_at: decision.stable_started_at,
        }

        if (!quality.is_document_detected || decision.rejection === "not_in_guide") {
          set_status("免許証を枠内に合わせてください")
        } else if (decision.rejection === "not_aligned") {
          set_status("枠にぴったり合わせてください")
        } else if (decision.rejection === "moving") {
          set_status("そのまま動かさないでください")
        } else {
          set_status("読み取り中です")
        }

        if (!decision.should_capture || capture_started_ref.current) return
        capture_started_ref.current = true
        stop_scan_ref.current?.()
        update_state("capturing")
        debug("OCR_CAPTURE_STARTED")

        try {
          const image = capture_video_frame({ video, frame })
          debug("OCR_CAPTURE_COMPLETED")
          void on_capture(image)
        } catch (error) {
          update_state("failed")
          on_failure(error instanceof Error ? error.message : "撮影できませんでした。")
        }
      },
    })

    return () => {
      stop_scan_ref.current?.()
      stop_scan_ref.current = null
    }
  }, [camera_ready, debug, frame, on_capture, on_failure, update_state])

  return (
    <div className="space-y-3">
      <div
        ref={container_ref}
        className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-black"
      >
        <video ref={video_ref} autoPlay muted playsInline className="h-full w-full object-cover" />
        {frame.width > 0 ? (
          <div
            className="pointer-events-none absolute rounded-xl border-2 border-white shadow-[0_0_0_999px_rgba(0,0,0,0.45)]"
            style={{ left: frame.x, top: frame.y, width: frame.width, height: frame.height }}
          />
        ) : null}
        <p className="absolute inset-x-3 bottom-4 text-center text-sm font-semibold text-white">
          {status}
        </p>
      </div>
    </div>
  )
})

export default Scanner
