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
import OcrFlowStatus from "@/components/ocr/flow_status"
import {
  capture_video_frame,
  evaluate_auto_capture_frame,
  read_file_as_data_url,
  resolve_scanner_frame,
  start_auto_scan,
  start_camera_from_user_gesture,
  type FrameQualityResult,
  type FrameRect,
  type OcrCameraStartResult,
} from "@/core/ocr/camera"
import {
  should_use_upload_only_for_ocr,
} from "@/core/ocr/browser"
import {
  read_camera_permission_denied_session,
  send_ocr_debug,
  type OcrDebugEvent,
} from "@/core/ocr/debug"
import {
  is_ocr_camera_start_blocked,
  reduce_ocr_flow,
  type OcrFailureType,
  type OcrFlowEvent,
  type OcrFlowState,
} from "@/core/ocr/flow"
import type { OcrImageSource } from "@/core/ocr/client"
import {
  OCR_AUTO_CAPTURE_DELAY_MS,
  OCR_CAPTURE_COOLDOWN_MS,
  type OcrDocumentType,
} from "@/core/ocr/rules"

export type DocumentScannerStartResult = OcrCameraStartResult
export type OcrCameraStopReason =
  | "user_close"
  | "accordion_close"
  | "component_unmount"
  | "route_change"
  | "retry"
  | "captured"
  | "completed"
  | "start_failed"
  | "capture_failed"

export type DocumentScannerHandle = {
  open_from_user_gesture: () => Promise<DocumentScannerStartResult>
  start_camera: () => Promise<DocumentScannerStartResult>
  stop_camera: (reason: OcrCameraStopReason) => void
  prepare_retry: () => void
}

type DocumentScannerProps = {
  document_type: OcrDocumentType
  on_capture: (input: {
    image_url: string
    source: OcrImageSource
  }) => void | Promise<void>
  on_running_change?: (running: boolean) => void
  flow_state: OcrFlowState
  on_flow_event: (event: OcrFlowEvent) => void
  failure_type?: OcrFailureType | null
  on_failure: (failure_type: OcrFailureType) => void
  disabled?: boolean
}

type ScannerFallbackReason = "line_in_app" | "permission_denied" | "unavailable"

const DocumentScanner = forwardRef<DocumentScannerHandle, DocumentScannerProps>(
  function DocumentScanner(
    {
      document_type,
      on_capture,
      on_running_change,
      flow_state,
      on_flow_event,
      failure_type,
      on_failure,
      disabled = false,
    },
    ref,
  ) {
    const container_ref = useRef<HTMLDivElement>(null)
    const video_ref = useRef<HTMLVideoElement>(null)
    const stream_ref = useRef<MediaStream | null>(null)
    const capture_done_ref = useRef(false)
    const camera_starting_ref = useRef(false)
    const camera_ready_ref = useRef(false)
    const flow_state_ref = useRef<OcrFlowState>(flow_state)
    const camera_request_id_ref = useRef(0)
    const route_change_ref = useRef(false)
    const stop_auto_scan_ref = useRef<(() => void) | null>(null)
    const auto_capture_enabled_at_ref = useRef<number | null>(null)
    const valid_frame_count_ref = useRef(0)
    const stable_started_at_ref = useRef<number | null>(null)
    const last_capture_at_ref = useRef<number | null>(null)
    const last_frame_debug_reason_ref = useRef<string | null>(null)
    const last_frame_debug_at_ref = useRef(0)
    const on_capture_ref = useRef(on_capture)
    const on_running_change_ref = useRef(on_running_change)
    const on_flow_event_ref = useRef(on_flow_event)
    const on_failure_ref = useRef(on_failure)

    on_capture_ref.current = on_capture
    on_running_change_ref.current = on_running_change
    on_flow_event_ref.current = on_flow_event
    on_failure_ref.current = on_failure
    flow_state_ref.current = flow_state

    const [upload_only] = useState(() => should_use_upload_only_for_ocr())
    const [camera_active, setCameraActive] = useState(false)
    const [fallback_reason, setFallbackReason] =
      useState<ScannerFallbackReason | null>(() => {
        if (should_use_upload_only_for_ocr()) {
          return "line_in_app"
        }

        return null
      })
    const [frame, setFrame] = useState<FrameRect>({ x: 0, y: 0, width: 0, height: 0 })
    const [quality, setQuality] = useState<FrameQualityResult | null>(null)

    const emit_flow_event = useCallback((event: OcrFlowEvent) => {
      const next_state = reduce_ocr_flow(flow_state_ref.current, event)
      flow_state_ref.current = next_state
      on_flow_event_ref.current(event)
    }, [])

    const debug_camera = useCallback((
      event: OcrDebugEvent,
      payload: Record<string, unknown> = {},
    ) => {
      const debug_payload = { document_type, ...payload }
      console.log(`[OCR_FLOW] ${event}`, debug_payload)
      void send_ocr_debug(event, debug_payload)
    }, [document_type])

    const stop_camera = useCallback((reason: string, options?: {
      reset_flow?: boolean
    }) => {
      debug_camera("OCR_CAMERA_STOP", { reason })
      camera_request_id_ref.current += 1

      stop_auto_scan_ref.current?.()
      stop_auto_scan_ref.current = null
      stream_ref.current?.getTracks().forEach((track) => track.stop())
      stream_ref.current = null
      camera_starting_ref.current = false
      camera_ready_ref.current = false

      if (video_ref.current) {
        video_ref.current.srcObject = null
      }

      setCameraActive(false)
      on_running_change_ref.current?.(false)
      console.log("[OCR_FLOW] camera_stopped", document_type)

      if (options?.reset_flow) {
        emit_flow_event("flow_reset")
      }
    }, [debug_camera, document_type, emit_flow_event])

    const mark_camera_ready = useCallback(() => {
      const video = video_ref.current

      if (
        camera_ready_ref.current ||
        !stream_ref.current ||
        !video ||
        video.videoWidth === 0 ||
        video.videoHeight === 0
      ) {
        return false
      }

      camera_ready_ref.current = true
      auto_capture_enabled_at_ref.current =
        Date.now() + OCR_AUTO_CAPTURE_DELAY_MS
      valid_frame_count_ref.current = 0
      stable_started_at_ref.current = null
      last_frame_debug_reason_ref.current = "initial_delay"
      last_frame_debug_at_ref.current = Date.now()
      setCameraActive(true)
      on_running_change_ref.current?.(true)
      emit_flow_event("camera_started")
      emit_flow_event("detection_started")
      debug_camera("OCR_AUTO_CAPTURE_DISABLED_INITIAL_DELAY", {
        delay_ms: OCR_AUTO_CAPTURE_DELAY_MS,
        enabled_at: auto_capture_enabled_at_ref.current,
      })
      console.log("[OCR_FLOW] camera_running", document_type)
      return true
    }, [debug_camera, document_type, emit_flow_event])

    const fail_camera = useCallback(() => {
      stop_camera("start_failed")
      emit_flow_event("flow_failed")
      on_failure_ref.current("camera_failed")
    }, [emit_flow_event, stop_camera])

    const request_camera = useCallback(async (): Promise<DocumentScannerStartResult> => {
      console.log("[OCR_FLOW] scan_start", document_type)
      debug_camera("OCR_CAMERA_START_REQUESTED", {
        camera_state: flow_state_ref.current,
      })

      if (camera_starting_ref.current) {
        debug_camera("OCR_CAMERA_START_SKIPPED", {
          reason: "already_starting_or_started",
          camera_state: flow_state_ref.current,
        })

        return {
          started: camera_ready_ref.current,
          stream: stream_ref.current,
          error: null,
          error_name: null,
          error_message: null,
          error_kind: null,
        }
      }

      if (stream_ref.current) {
        debug_camera("OCR_CAMERA_START_SKIPPED", {
          reason: "stream_already_exists",
          camera_state: flow_state_ref.current,
        })

        return {
          started: camera_ready_ref.current,
          stream: stream_ref.current,
          error: null,
          error_name: null,
          error_message: null,
          error_kind: null,
        }
      }

      if (is_ocr_camera_start_blocked(flow_state_ref.current)) {
        debug_camera("OCR_CAMERA_START_SKIPPED", {
          reason: "flow_state_blocked",
          camera_state: flow_state_ref.current,
        })

        return {
          started: false,
          stream: null,
          error: null,
          error_name: null,
          error_message: null,
          error_kind: null,
        }
      }

      if (disabled || capture_done_ref.current || upload_only || fallback_reason) {
        on_running_change_ref.current?.(false)
        emit_flow_event("flow_failed")
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
        fail_camera()
        on_running_change_ref.current?.(false)
        return {
          started: false,
          stream: null,
          error: "カメラの許可が必要です",
          error_name: "NotAllowedError",
          error_message: "Permission denied",
          error_kind: "permission_denied",
        }
      }

      capture_done_ref.current = false
      auto_capture_enabled_at_ref.current = null
      valid_frame_count_ref.current = 0
      stable_started_at_ref.current = null
      last_frame_debug_reason_ref.current = null
      last_frame_debug_at_ref.current = 0
      camera_starting_ref.current = true
      camera_ready_ref.current = false
      const request_id = camera_request_id_ref.current + 1
      camera_request_id_ref.current = request_id
      on_running_change_ref.current?.(true)
      emit_flow_event("scan_requested")
      console.log("[OCR_FLOW] camera_permission_request", document_type)

      try {
        const result = await start_camera_from_user_gesture({
          document_type,
          facing_mode: "environment",
        })

        if (camera_request_id_ref.current !== request_id) {
          result.stream?.getTracks().forEach((track) => track.stop())
          return {
            ...result,
            started: false,
            stream: null,
          }
        }

        if (!result.stream) {
          debug_camera("OCR_CAMERA_START_FAILED", {
            error_name: result.error_name,
            error_message: result.error_message,
            error_kind: result.error_kind,
          })

          fail_camera()
          return result
        }

        stream_ref.current = result.stream
        debug_camera("OCR_CAMERA_STREAM_RECEIVED", {
          track_count: result.stream.getTracks().length,
        })

        const video = video_ref.current

        if (!video) {
          throw new Error("OCR video element is not mounted")
        }

        video.srcObject = result.stream
        video.muted = true
        video.playsInline = true
        setFallbackReason(null)

        await video.play()

        debug_camera("OCR_CAMERA_PLAYING", {
          video_width: video.videoWidth,
          video_height: video.videoHeight,
        })

        mark_camera_ready()

        return {
          ...result,
          started: camera_ready_ref.current,
        }
      } catch (error) {
        const error_name = error instanceof Error ? error.name : "UnknownError"
        const error_message = error instanceof Error ? error.message : String(error)

        debug_camera("OCR_CAMERA_START_FAILED", {
          error_name,
          error_message,
        })
        stop_camera("start_failed")
        emit_flow_event("flow_failed")
        on_failure_ref.current("camera_failed")

        return {
          started: false,
          stream: null,
          error: error_message,
          error_name,
          error_message,
          error_kind: "failed",
        }
      }
    }, [
      debug_camera,
      disabled,
      document_type,
      emit_flow_event,
      fail_camera,
      fallback_reason,
      mark_camera_ready,
      stop_camera,
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
        stop_camera: (reason) =>
          stop_camera(reason, {
            reset_flow: true,
          }),
        prepare_retry: () => {
          stop_camera("retry")
          flow_state_ref.current = reduce_ocr_flow(
            flow_state_ref.current,
            "retry_requested",
          )
          capture_done_ref.current = false
          camera_starting_ref.current = false
          camera_ready_ref.current = false
          auto_capture_enabled_at_ref.current = null
          valid_frame_count_ref.current = 0
          stable_started_at_ref.current = null
          last_capture_at_ref.current = null
          last_frame_debug_reason_ref.current = null
          last_frame_debug_at_ref.current = 0
        },
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
      debug_camera("OCR_COMPONENT_MOUNT")

      const mark_route_change = () => {
        route_change_ref.current = true
      }

      window.addEventListener("pagehide", mark_route_change)

      return () => {
        window.removeEventListener("pagehide", mark_route_change)
        console.log("[OCR_UI] camera_unmount", document_type)
        debug_camera("OCR_COMPONENT_UNMOUNT")
        stop_camera(
          route_change_ref.current ? "route_change" : "component_unmount",
        )
      }
    }, [debug_camera, document_type, stop_camera])

    const capture_once = useCallback(async (
      reason: "auto" | "manual",
    ) => {
      const now = Date.now()

      if (capture_done_ref.current) {
        debug_camera("OCR_CAPTURE_SKIPPED_ALREADY_DONE", { reason })
        return
      }

      if (
        last_capture_at_ref.current != null &&
        now - last_capture_at_ref.current < OCR_CAPTURE_COOLDOWN_MS
      ) {
        debug_camera("OCR_CAPTURE_SKIPPED_ALREADY_DONE", {
          reason: "capture_cooldown",
          requested_reason: reason,
        })
        return
      }

      const video = video_ref.current

      if (!video || !camera_ready_ref.current || frame.width <= 0) {
        debug_camera("OCR_CAPTURE_SKIPPED_ALREADY_DONE", {
          reason: "video_not_ready",
          requested_reason: reason,
        })
        return
      }

      capture_done_ref.current = true
      last_capture_at_ref.current = now
      stop_auto_scan_ref.current?.()
      stop_auto_scan_ref.current = null
      emit_flow_event("capture_started")
      debug_camera("OCR_CAPTURE_STARTED", { reason })

      try {
        const image_url = capture_video_frame({ video, frame })
        debug_camera("OCR_CAPTURE_COMPLETED", { reason })
        stop_camera("captured")
        await on_capture_ref.current({ image_url, source: "camera_capture" })
      } catch (error) {
        console.error("[OCR_FLOW] OCR_CAPTURE_FAILED", {
          document_type,
          error_name: error instanceof Error ? error.name : "UnknownError",
          error_message: error instanceof Error ? error.message : String(error),
        })
        stop_camera("capture_failed")
        emit_flow_event("flow_failed")
        on_failure_ref.current("capture_failed")
      }
    }, [debug_camera, document_type, emit_flow_event, frame, stop_camera])

    const handle_frame_quality = useCallback((next_quality: FrameQualityResult) => {
      setQuality(next_quality)

      if (capture_done_ref.current) {
        return
      }

      if (
        flow_state_ref.current !== "detecting" &&
        flow_state_ref.current !== "ready_to_capture"
      ) {
        return
      }

      const decision = evaluate_auto_capture_frame({
        frame_result: next_quality,
        now: Date.now(),
        enabled_at: auto_capture_enabled_at_ref.current,
        valid_frame_count: valid_frame_count_ref.current,
        stable_started_at: stable_started_at_ref.current,
      })

      valid_frame_count_ref.current = decision.valid_frame_count
      stable_started_at_ref.current = decision.stable_started_at

      const debug_event =
        decision.rejection === "not_in_guide"
          ? "OCR_FRAME_REJECTED_NOT_IN_GUIDE"
          : decision.rejection === "moving"
            ? "OCR_FRAME_REJECTED_MOVING"
            : decision.rejection === "blur"
              ? "OCR_FRAME_REJECTED_BLUR"
              : decision.rejection === "brightness"
                ? "OCR_FRAME_REJECTED_DARK"
                : decision.rejection === null
                  ? "OCR_FRAME_VALID"
                  : null

      if (
        decision.rejection &&
        decision.rejection !== "initial_delay" &&
        flow_state_ref.current === "ready_to_capture"
      ) {
        emit_flow_event("detection_started")
      }

      const debug_reason = decision.rejection ?? "valid"

      const debug_now = Date.now()

      if (
        debug_event &&
        last_frame_debug_reason_ref.current !== debug_reason &&
        debug_now - last_frame_debug_at_ref.current >= 500
      ) {
        debug_camera(debug_event, {
          score: next_quality.score,
          issues: next_quality.issues,
          valid_frame_count: decision.valid_frame_count,
          stable_ms: decision.stable_ms,
        })
        last_frame_debug_reason_ref.current = debug_reason
        last_frame_debug_at_ref.current = debug_now
      }

      if (decision.rejection === null && flow_state_ref.current === "detecting") {
        emit_flow_event("document_stable")
      }

      if (decision.should_capture) {
        debug_camera("OCR_AUTO_CAPTURE_READY", {
          valid_frame_count: decision.valid_frame_count,
          stable_ms: decision.stable_ms,
        })
        void capture_once("auto")
      }
    }, [capture_once, debug_camera, emit_flow_event])

    useEffect(() => {
      if (!camera_active || disabled || capture_done_ref.current || fallback_reason) {
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
        on_quality: handle_frame_quality,
        is_cancelled: () => capture_done_ref.current,
      })

      return () => {
        stop_auto_scan_ref.current?.()
        stop_auto_scan_ref.current = null
      }
    }, [
      camera_active,
      disabled,
      fallback_reason,
      frame,
      handle_frame_quality,
    ])

    async function handle_file_select(file: File) {
      console.log("[OCR_FLOW] capture_start", document_type)
      capture_done_ref.current = true
      emit_flow_event("capture_started")

      if (stream_ref.current || camera_starting_ref.current) {
        stop_camera("captured")
      }

      const image_url = await read_file_as_data_url(file)
      debug_camera("OCR_CAPTURE_COMPLETED", { reason: "image_upload" })
      await on_capture_ref.current({ image_url, source: "image_upload" })
    }

    async function handle_file_input(event: ChangeEvent<HTMLInputElement>) {
      const file = event.target.files?.[0]

      if (!file) {
        return
      }

      await handle_file_select(file)
      event.target.value = ""
    }

    const handle_loaded_metadata = () => {
      debug_camera("OCR_VIDEO_METADATA_LOADED", {
        video_width: video_ref.current?.videoWidth ?? 0,
        video_height: video_ref.current?.videoHeight ?? 0,
      })
    }

    const handle_can_play = () => {
      debug_camera("OCR_VIDEO_CAN_PLAY", {
        video_width: video_ref.current?.videoWidth ?? 0,
        video_height: video_ref.current?.videoHeight ?? 0,
      })
      mark_camera_ready()
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
          data-camera-state={flow_state}
        >
          <OcrFlowStatus state={flow_state} failure_type={failure_type} />
          <video
            ref={video_ref}
            autoPlay
            playsInline
            muted
            onLoadedMetadata={handle_loaded_metadata}
            onCanPlay={handle_can_play}
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

          <div
            className={
              frame.width > 0
                ? "pointer-events-none absolute inset-x-0 px-3 pt-2"
                : "pointer-events-none absolute inset-x-0 bottom-0 px-3 pb-3"
            }
            style={
              frame.width > 0
                ? { top: frame.y + frame.height }
                : undefined
            }
          >
            <p className="text-center text-sm font-medium leading-6 text-white">
              {guidance}
            </p>
          </div>
        </div>

        {!camera_active && flow_state !== "failed" ? (
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
        ) : camera_active ? (
          <button
            type="button"
            disabled={disabled || capture_done_ref.current}
            onClick={() => void capture_once("manual")}
            className="inline-flex items-center justify-center rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            撮影する
          </button>
        ) : null}
      </div>
    )
  },
)

export default DocumentScanner
