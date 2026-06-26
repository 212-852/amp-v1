"use client"

import type { ChangeEvent } from "react"
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react"

import OcrCameraFallback from "@/components/ocr/camera_fallback"
import {
  read_file_as_data_url,
  resolve_scanner_frame,
  start_auto_scan,
  start_camera_from_user_gesture,
  type FrameQualityResult,
  type FrameRect,
  type OcrCameraStartResult,
} from "@/core/ocr/camera"
import {
  is_camera_api_available,
  should_use_upload_only_for_ocr,
} from "@/core/ocr/browser"
import { read_camera_permission_denied_session } from "@/core/ocr/debug"
import type { OcrImageSource } from "@/core/ocr/client"
import {
  OCR_AUTO_SCAN_TIMEOUT_MS,
  type OcrDocumentType,
} from "@/core/ocr/rules"

export type DocumentScannerStartResult = OcrCameraStartResult

export type DocumentScannerHandle = {
  open_from_user_gesture: () => Promise<DocumentScannerStartResult>
  start_camera: () => Promise<DocumentScannerStartResult>
  stop_camera: () => void
}

type DocumentScannerProps = {
  document_type: OcrDocumentType
  on_capture: (input: { image_url: string; source: OcrImageSource }) => void
  on_running_change?: (running: boolean) => void
  disabled?: boolean
}

type ScannerFallbackReason = "line_in_app" | "permission_denied" | "unavailable"

type OcrCameraState =
  | "idle"
  | "requesting"
  | "running"
  | "capturing"
  | "analyzing"
  | "completed"
  | "error"

function is_camera_start_blocked(state: OcrCameraState) {
  return (
    state === "requesting" ||
    state === "running" ||
    state === "capturing" ||
    state === "analyzing" ||
    state === "completed"
  )
}

const DocumentScanner = forwardRef<DocumentScannerHandle, DocumentScannerProps>(
  function DocumentScanner(
    {
      document_type,
      on_capture,
      on_running_change,
      disabled = false,
    },
    ref,
  ) {
    const container_ref = useRef<HTMLDivElement>(null)
    const video_ref = useRef<HTMLVideoElement>(null)
    const stream_ref = useRef<MediaStream | null>(null)
    const captured_ref = useRef(false)
    const camera_started_ref = useRef(false)
    const camera_state_ref = useRef<OcrCameraState>("idle")
    const stop_auto_scan_ref = useRef<(() => void) | null>(null)

    const [upload_only] = useState(() => should_use_upload_only_for_ocr())
    const [camera_active, setCameraActive] = useState(false)
    const [camera_state, setCameraState] = useState<OcrCameraState>("idle")
    const [fallback_reason, setFallbackReason] =
      useState<ScannerFallbackReason | null>(() => {
        if (should_use_upload_only_for_ocr()) {
          return "line_in_app"
        }

        if (read_camera_permission_denied_session()) {
          return "permission_denied"
        }

        if (!is_camera_api_available()) {
          return "unavailable"
        }

        return null
      })
    const [frame, setFrame] = useState<FrameRect>({ x: 0, y: 0, width: 0, height: 0 })
    const [quality, setQuality] = useState<FrameQualityResult | null>(null)

    const update_camera_state = useCallback((next_state: OcrCameraState) => {
      camera_state_ref.current = next_state
      setCameraState(next_state)
    }, [])

    const stop_camera = useCallback((options?: {
      reset_started?: boolean
      next_state?: OcrCameraState
    }) => {
      stop_auto_scan_ref.current?.()
      stop_auto_scan_ref.current = null
      stream_ref.current?.getTracks().forEach((track) => track.stop())
      stream_ref.current = null
      setCameraActive(false)
      on_running_change?.(false)
      console.log("[OCR_FLOW] camera_stopped", document_type)

      if (options?.reset_started) {
        camera_started_ref.current = false
      }

      update_camera_state(options?.next_state ?? "idle")
    }, [document_type, on_running_change, update_camera_state])

    const attach_stream = useCallback(async (stream: MediaStream) => {
      stream_ref.current = stream
      const video = video_ref.current

      if (video) {
        video.srcObject = stream
        await video.play()
      }

      setCameraActive(true)
      on_running_change?.(true)
      update_camera_state("running")
      console.log("[OCR_FLOW] camera_running", document_type)
      setFallbackReason(null)
    }, [document_type, on_running_change, update_camera_state])

    const enter_upload_fallback = useCallback((reason: ScannerFallbackReason) => {
      stop_camera({ reset_started: true, next_state: "error" })
      setFallbackReason(reason)
    }, [stop_camera])

    const apply_camera_result = useCallback(
      async (result: OcrCameraStartResult) => {
        if (result.stream) {
          await attach_stream(result.stream)
          return result
        }

        if (
          result.error_kind === "permission_denied" ||
          result.error_kind === "permission_dismissed"
        ) {
          enter_upload_fallback("permission_denied")
        } else if (result.error_kind === "unavailable" || result.error_kind === "failed") {
          enter_upload_fallback("unavailable")
        }

        return result
      },
      [attach_stream, enter_upload_fallback],
    )

    const request_camera = useCallback(async (): Promise<DocumentScannerStartResult> => {
      console.log("[OCR_FLOW] scan_start", document_type)

      if (
        camera_started_ref.current ||
        is_camera_start_blocked(camera_state_ref.current)
      ) {
        console.log("[OCR_FLOW] camera_request_skipped_already_started", {
          document_type,
          camera_state: camera_state_ref.current,
        })

        return {
          started: camera_state_ref.current === "running",
          stream: stream_ref.current,
          error: null,
          error_name: null,
          error_message: null,
          error_kind: null,
        }
      }

      if (disabled || captured_ref.current || upload_only || fallback_reason) {
        on_running_change?.(false)
        update_camera_state("error")
        return {
          started: false,
          stream: null,
          error: disabled ? "disabled" : "unavailable",
          error_name: disabled ? "Disabled" : "Unavailable",
          error_message: disabled ? "Scanner is disabled" : "Scanner unavailable",
          error_kind: "failed",
        }
      }

      if (read_camera_permission_denied_session()) {
        enter_upload_fallback("permission_denied")
        on_running_change?.(false)
        return {
          started: false,
          stream: null,
          error: "カメラの許可が必要です",
          error_name: "NotAllowedError",
          error_message: "Permission denied",
          error_kind: "permission_denied",
        }
      }

      captured_ref.current = false
      camera_started_ref.current = true
      on_running_change?.(true)
      update_camera_state("requesting")
      console.log("[OCR_FLOW] camera_permission_request", document_type)

      const result = await start_camera_from_user_gesture({
        document_type,
        facing_mode: "environment",
      })

      if (!result.stream) {
        camera_started_ref.current = false
        on_running_change?.(false)
        update_camera_state("error")
      }

      return apply_camera_result(result)
    }, [
      apply_camera_result,
      disabled,
      document_type,
      enter_upload_fallback,
      fallback_reason,
      on_running_change,
      update_camera_state,
      upload_only,
    ])

    const open_from_user_gesture = useCallback(() => {
      return request_camera()
    }, [request_camera])

    useImperativeHandle(
      ref,
      () => ({
        open_from_user_gesture,
        start_camera: request_camera,
        stop_camera: () => stop_camera({ reset_started: true }),
      }),
      [open_from_user_gesture, request_camera, stop_camera],
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
      console.log("[OCR_UI] camera_mount", document_type)

      return () => {
        console.log("[OCR_UI] camera_unmount", document_type)
        stop_camera()
      }
    }, [document_type, stop_camera])

    useEffect(() => {
      if (!camera_active || disabled || captured_ref.current || fallback_reason) {
        return
      }

      const video = video_ref.current

      if (!video) {
        return
      }

      stop_auto_scan_ref.current?.()
      stop_auto_scan_ref.current = start_auto_scan({
        video,
        frame,
        on_quality: setQuality,
        on_capture: (image_url) => {
          console.log("[OCR_FLOW] capture_start", document_type)
          captured_ref.current = true
          update_camera_state("capturing")
          stop_camera({ next_state: "analyzing" })
          on_capture({ image_url, source: "camera_capture" })
          update_camera_state("completed")
        },
        is_cancelled: () => captured_ref.current,
      })

      return () => {
        stop_auto_scan_ref.current?.()
        stop_auto_scan_ref.current = null
      }
    }, [
      camera_active,
      disabled,
      document_type,
      fallback_reason,
      frame,
      on_capture,
      stop_camera,
      update_camera_state,
    ])

    useEffect(() => {
      if (!camera_active || captured_ref.current || fallback_reason) {
        return
      }

      const timer = window.setTimeout(() => {
        if (captured_ref.current) {
          return
        }

        enter_upload_fallback("unavailable")
      }, OCR_AUTO_SCAN_TIMEOUT_MS)

      return () => window.clearTimeout(timer)
    }, [camera_active, enter_upload_fallback, fallback_reason])

    async function handle_file_select(file: File) {
      console.log("[OCR_FLOW] capture_start", document_type)
      captured_ref.current = true
      stop_camera({ next_state: "analyzing" })

      const image_url = await read_file_as_data_url(file)
      on_capture({ image_url, source: "image_upload" })
      update_camera_state("completed")
    }

    async function handle_file_input(event: ChangeEvent<HTMLInputElement>) {
      const file = event.target.files?.[0]

      if (!file) {
        return
      }

      await handle_file_select(file)
      event.target.value = ""
    }

    const guidance = quality?.guidance_message ?? "枠内に合わせてください"

    if (fallback_reason) {
      return (
        <OcrCameraFallback
          disabled={disabled}
          show_browser_instructions={fallback_reason === "line_in_app"}
          reason={fallback_reason}
          on_file_select={handle_file_select}
        />
      )
    }

    return (
      <div className="space-y-3">
        <div
          ref={container_ref}
          className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-black"
          data-camera-state={camera_state}
        >
          <video
            ref={video_ref}
            autoPlay
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

        {!camera_active ? (
          <label className="inline-flex cursor-pointer items-center justify-center rounded-full border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-50">
            画像を選択
            <input
              type="file"
              accept="image/*"
              disabled={disabled}
              onChange={(event) => void handle_file_input(event)}
              className="sr-only"
            />
          </label>
        ) : null}
      </div>
    )
  },
)

export default DocumentScanner
