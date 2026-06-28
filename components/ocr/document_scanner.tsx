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
  get_driver_task_unmount_reason,
  record_driver_license_mount,
} from "@/components/driver/task_modal_runtime"
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
  enrich_ocr_debug_payload,
  is_ocr_debug_event_enabled,
  read_camera_permission_denied_session,
  send_ocr_debug,
  set_ocr_debug_context,
  type OcrDebugEvent,
} from "@/core/ocr/debug"
import {
  is_ocr_camera_start_blocked,
  reduce_ocr_flow,
  resolve_auto_scan_status,
  type OcrFailureType,
  type OcrFlowEvent,
  type OcrFlowState,
} from "@/core/ocr/flow"
import type { OcrImageSource } from "@/core/ocr/client"
import type { OcrDocumentType } from "@/core/ocr/rules"
import { OCR_AUTO_CAPTURE_DELAY_MS } from "@/core/ocr/rules"

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
  component_instance_id?: string
  is_active?: boolean
  is_open?: boolean
  accordion_locked?: boolean
  is_locked?: boolean
  on_capture: (input: {
    image_url: string
    source: OcrImageSource
  }) => void | Promise<void>
  on_running_change?: (running: boolean) => void
  flow_state: OcrFlowState
  on_flow_event: (event: OcrFlowEvent) => void
  on_lock?: () => void
  on_unlock?: () => void
  failure_type?: OcrFailureType | null
  on_failure: (failure_type: OcrFailureType) => void
  disabled?: boolean
  frozen_preview_url?: string
}

type ScannerFallbackReason = "line_in_app" | "permission_denied" | "unavailable"

const CAMERA_STOP_ALLOWED_DURING_LOCK = new Set([
  "user_close",
  "retry",
  "route_change",
  "completed",
  "start_failed",
  "capture_failed",
])

function read_video_track_diagnostics(stream: MediaStream | null) {
  const track = stream?.getVideoTracks()[0] ?? null

  return {
    track_ready_state: track?.readyState ?? null,
    track_enabled: track?.enabled ?? null,
    track_muted: track?.muted ?? null,
  }
}

function create_component_instance_id() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }

  return `ocr-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

const ActiveDocumentScanner = forwardRef<DocumentScannerHandle, DocumentScannerProps>(
  function DocumentScanner(
    {
      document_type,
      component_instance_id,
      is_open = true,
      accordion_locked = false,
      is_locked = false,
      on_capture,
      on_running_change,
      flow_state,
      on_flow_event,
      on_lock,
      on_unlock,
      failure_type,
      on_failure,
      disabled = false,
      frozen_preview_url = "",
    },
    ref,
  ) {
    const container_ref = useRef<HTMLDivElement>(null)
    const component_instance_id_ref = useRef(
      component_instance_id ?? create_component_instance_id(),
    )
    const document_type_ref = useRef(document_type)
    const video_ref = useRef<HTMLVideoElement | null>(null)
    const stream_ref = useRef<MediaStream | null>(null)
    const pending_stream_ref = useRef<MediaStream | null>(null)
    const capture_done_ref = useRef(false)
    const camera_starting_ref = useRef(false)
    const camera_ready_ref = useRef(false)
    const flow_state_ref = useRef<OcrFlowState>(flow_state)
    const camera_request_id_ref = useRef(0)
    const route_change_ref = useRef(false)
    const stop_auto_scan_ref = useRef<(() => void) | null>(null)
    const auto_capture_state_ref = useRef({
      enabled_at: null as number | null,
      valid_frame_count: 0,
      stable_started_at: null as number | null,
    })
    const camera_start_once_ref = useRef(false)
    const lifecycle_generation_ref = useRef(0)
    const lifecycle_mount_logged_ref = useRef(false)
    const on_capture_ref = useRef(on_capture)
    const on_running_change_ref = useRef(on_running_change)
    const on_flow_event_ref = useRef(on_flow_event)
    const on_failure_ref = useRef(on_failure)
    const on_lock_ref = useRef(on_lock)
    const on_unlock_ref = useRef(on_unlock)
    const ocr_locked_ref = useRef(false)
    const is_open_ref = useRef(is_open)
    const stop_camera_ref = useRef<
      (reason: OcrCameraStopReason) => void
    >(() => undefined)

    on_capture_ref.current = on_capture
    on_running_change_ref.current = on_running_change
    on_flow_event_ref.current = on_flow_event
    on_failure_ref.current = on_failure
    on_lock_ref.current = on_lock
    on_unlock_ref.current = on_unlock
    is_open_ref.current = is_open

    useEffect(() => {
      ocr_locked_ref.current = accordion_locked || is_locked
    }, [accordion_locked, is_locked])

    useEffect(() => {
      if (flow_state === "completed") {
        ocr_locked_ref.current = false
      }
    }, [flow_state])
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
    const [scan_status, setScanStatus] = useState("免許証を枠内に合わせてください")
    const detecting_started_ref = useRef(false)
    const ready_to_capture_emitted_ref = useRef(false)

    set_ocr_debug_context({
      component_instance_id: component_instance_id_ref.current,
      document_type,
      scan_state: flow_state,
      camera_state: camera_active ? "running" : flow_state,
    })

    const emit_flow_event = useCallback((event: OcrFlowEvent) => {
      const next_state = reduce_ocr_flow(flow_state_ref.current, event)
      flow_state_ref.current = next_state
      on_flow_event_ref.current(event)
    }, [])

    const debug_camera = useCallback((
      event: OcrDebugEvent,
      payload: Record<string, unknown> = {},
    ) => {
      const debug_payload = enrich_ocr_debug_payload({
        component_instance_id: component_instance_id_ref.current,
        document_type,
        scan_state: flow_state_ref.current,
        camera_state: camera_active ? "running" : flow_state_ref.current,
        ...payload,
      })
      if (is_ocr_debug_event_enabled(event)) {
        console.log(`[OCR_FLOW] ${event}`, debug_payload)
      }
      void send_ocr_debug(event, debug_payload)
    }, [camera_active, document_type])

    const attach_stream_to_video = useCallback(async (stream: MediaStream) => {
      stream_ref.current = stream

      const video = video_ref.current

      if (!video) {
        pending_stream_ref.current = stream
        debug_camera("OCR_CAMERA_STREAM_PENDING", {
          track_count: stream.getTracks().length,
        })
        return false
      }

      pending_stream_ref.current = null
      video.srcObject = stream
      video.muted = true
      video.playsInline = true

      try {
        await video.play()
      } catch (error) {
        debug_camera("OCR_CAMERA_PLAY_FAILED", {
          error_name: error instanceof Error ? error.name : "UnknownError",
          error_message: error instanceof Error ? error.message : String(error),
        })
      }

      camera_starting_ref.current = false
      setCameraActive(true)
      on_running_change_ref.current?.(true)

      debug_camera("OCR_CAMERA_PLAYING", {
        video_width: video.videoWidth,
        video_height: video.videoHeight,
        ...read_video_track_diagnostics(stream),
      })

      if (video.videoWidth > 0 && video.videoHeight > 0) {
        if (!camera_ready_ref.current) {
          camera_ready_ref.current = true
          emit_flow_event("camera_started")
        }
      }

      return true
    }, [debug_camera, emit_flow_event])

    const check_black_preview = useCallback(() => {
      if (!camera_active || frozen_preview_url) {
        return
      }

      const video = video_ref.current
      const stream = stream_ref.current
      const has_src_object = Boolean(video?.srcObject)
      const payload = {
        has_video_ref: Boolean(video),
        has_src_object,
        video_width: video?.videoWidth ?? 0,
        video_height: video?.videoHeight ?? 0,
        ready_state: video?.readyState ?? null,
        paused: video?.paused ?? null,
        ended: video?.ended ?? null,
        ...read_video_track_diagnostics(stream),
      }

      const looks_black =
        camera_active &&
        (!has_src_object ||
          (video?.videoWidth ?? 0) === 0 ||
          video?.paused)

      if (!looks_black) {
        return
      }

      void send_ocr_debug("OCR_VIDEO_BLACK_PREVIEW_CHECK", payload)

      if (stream && video && !has_src_object) {
        void attach_stream_to_video(stream)
        return
      }

      if (video?.paused) {
        void video.play().catch(() => undefined)
      }
    }, [attach_stream_to_video, camera_active, frozen_preview_url])

    const set_video_element = useCallback((node: HTMLVideoElement | null) => {
      video_ref.current = node

      if (!node) {
        return
      }

      const stream = pending_stream_ref.current ?? stream_ref.current

      if (stream) {
        void attach_stream_to_video(stream)
      }
    }, [attach_stream_to_video])

    const should_block_camera_stop = useCallback((reason: string) => {
      if (!ocr_locked_ref.current) {
        return false
      }

      return !CAMERA_STOP_ALLOWED_DURING_LOCK.has(reason)
    }, [])

    const stop_camera = useCallback((reason: string, options?: {
      reset_flow?: boolean
      release_stream?: boolean
    }) => {
      if (should_block_camera_stop(reason)) {
        debug_camera("OCR_CAMERA_STOP_BLOCKED", {
          reason,
          scan_state: flow_state_ref.current,
        })
        return
      }

      stop_auto_scan_ref.current?.()
      stop_auto_scan_ref.current = null

      const release_stream = options?.release_stream ?? true

      if (release_stream) {
        debug_camera("OCR_CAMERA_STOP", { reason })
        camera_request_id_ref.current += 1

        stream_ref.current?.getTracks().forEach((track) => track.stop())
        stream_ref.current = null
        pending_stream_ref.current = null

        if (video_ref.current) {
          video_ref.current.srcObject = null
        }

        camera_starting_ref.current = false
        camera_ready_ref.current = false
        setCameraActive(false)
        on_running_change_ref.current?.(false)
      } else {
        debug_camera("OCR_CAMERA_SCAN_PAUSED", { reason })
      }

      if (options?.reset_flow) {
        emit_flow_event("flow_reset")
      }
    }, [debug_camera, emit_flow_event, should_block_camera_stop])

    stop_camera_ref.current = (reason) => stop_camera(reason)

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
      setCameraActive(true)
      on_running_change_ref.current?.(true)
      emit_flow_event("camera_started")
      return true
    }, [emit_flow_event])

    const fail_camera = useCallback(() => {
      stop_camera("start_failed")
      emit_flow_event("flow_failed")
      on_failure_ref.current("camera_failed")
    }, [emit_flow_event, stop_camera])

    const request_camera = useCallback(async (): Promise<DocumentScannerStartResult> => {
      debug_camera("OCR_CAMERA_START_REQUESTED", {
        camera_state: flow_state_ref.current,
      })

      if (camera_start_once_ref.current) {
        debug_camera("OCR_CAMERA_START_SKIPPED", {
          reason: "start_once_per_session",
          camera_state: flow_state_ref.current,
        })

        if (stream_ref.current) {
          await attach_stream_to_video(stream_ref.current)
        }

        return {
          started: camera_ready_ref.current || camera_active,
          stream: stream_ref.current,
          error: null,
          error_name: null,
          error_message: null,
          error_kind: null,
        }
      }

      if (camera_starting_ref.current) {
        debug_camera("OCR_CAMERA_START_SKIPPED", {
          reason: "already_starting",
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

        await attach_stream_to_video(stream_ref.current)

        return {
          started: camera_ready_ref.current || camera_active,
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
      camera_starting_ref.current = true
      camera_start_once_ref.current = true
      camera_ready_ref.current = false
      const request_id = camera_request_id_ref.current + 1
      camera_request_id_ref.current = request_id
      on_running_change_ref.current?.(true)
      ocr_locked_ref.current = true
      on_lock_ref.current?.()
      emit_flow_event("scan_requested")

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

        setFallbackReason(null)
        await attach_stream_to_video(result.stream)

        return {
          ...result,
          started: camera_ready_ref.current || camera_active,
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
      attach_stream_to_video,
      camera_active,
    ])

    const open_from_user_gesture = useCallback(() => {
      return request_camera()
    }, [request_camera])

    useImperativeHandle(
      ref,
      () => ({
        open_from_user_gesture,
        start_camera: request_camera,
        stop_camera: (reason) => {
          if (should_block_camera_stop(reason)) {
            debug_camera("OCR_CAMERA_STOP_BLOCKED", {
              reason,
              scan_state: flow_state_ref.current,
            })
            return
          }

          stop_camera(reason, {
            reset_flow: true,
          })
        },
        prepare_retry: () => {
          stop_camera("retry")
          flow_state_ref.current = reduce_ocr_flow(
            flow_state_ref.current,
            "retry_requested",
          )
          capture_done_ref.current = false
          camera_starting_ref.current = false
          camera_ready_ref.current = false
          camera_start_once_ref.current = false
          detecting_started_ref.current = false
          ready_to_capture_emitted_ref.current = false
          ocr_locked_ref.current = true
          on_lock_ref.current?.()
          auto_capture_state_ref.current = {
            enabled_at: null,
            valid_frame_count: 0,
            stable_started_at: null,
          }
          setScanStatus("免許証を枠内に合わせてください")
        },
      }),
      [open_from_user_gesture, request_camera, stop_camera, should_block_camera_stop, debug_camera],
    )

    useEffect(() => {
      if (flow_state !== "completed") {
        return
      }

      ocr_locked_ref.current = false
      stop_camera("completed")
    }, [flow_state, stop_camera])

    useEffect(() => {
      if (!camera_active || frozen_preview_url) {
        return
      }

      const interval_id = window.setInterval(() => {
        check_black_preview()
      }, 1500)

      return () => window.clearInterval(interval_id)
    }, [camera_active, check_black_preview, frozen_preview_url])

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
      const lifecycle_generation = ++lifecycle_generation_ref.current
      const component_instance_id = component_instance_id_ref.current
      const mount_document_type = document_type_ref.current
      const mount_payload = {
        component_instance_id,
        document_type: mount_document_type,
        scan_state: flow_state_ref.current,
        camera_state: flow_state_ref.current,
      }
      if (!lifecycle_mount_logged_ref.current) {
        lifecycle_mount_logged_ref.current = true

        if (mount_document_type === "driver_license_front") {
          const mount_result = record_driver_license_mount(
            component_instance_id,
            "license_task",
          )

          if (mount_result.duplicate_detected) {
            void send_ocr_debug("REACT_STRICT_MODE_DUPLICATE_MOUNT_DETECTED", {
              mount_surface: "license_task",
              document_type: mount_document_type,
              component_instance_id,
              previous_component_instance_id:
                mount_result.previous_component_instance_id,
            })
          }
        }

        void send_ocr_debug("OCR_COMPONENT_MOUNT", mount_payload)
      }

      const mark_route_change = () => {
        route_change_ref.current = true
      }

      window.addEventListener("pagehide", mark_route_change)

      return () => {
        window.removeEventListener("pagehide", mark_route_change)
        queueMicrotask(() => {
          if (lifecycle_generation_ref.current !== lifecycle_generation) {
            return
          }

          const unmount_payload = {
            component_instance_id,
            document_type: mount_document_type,
            scan_state: flow_state_ref.current,
            camera_state: flow_state_ref.current,
            reason:
              mount_document_type === "driver_license_front"
                ? get_driver_task_unmount_reason()
                : route_change_ref.current
                  ? "route_changed"
                  : "unknown",
          }

          if (ocr_locked_ref.current) {
            void send_ocr_debug("OCR_COMPONENT_UNMOUNT_BLOCKED", {
              ...unmount_payload,
              reason: "ocr_locked",
            })
            return
          }

          void send_ocr_debug("OCR_COMPONENT_UNMOUNT", unmount_payload)
          stop_camera_ref.current(
            route_change_ref.current ? "route_change" : "component_unmount",
          )
        })
      }
    }, [])

    const capture_once = useCallback(async (reason: "auto_capture") => {
      if (capture_done_ref.current) {
        debug_camera("OCR_CAPTURE_SKIPPED_ALREADY_DONE", { reason })
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
      stop_auto_scan_ref.current?.()
      stop_auto_scan_ref.current = null
      emit_flow_event("capture_started")
      debug_camera("OCR_CAPTURE_STARTED", { reason })

      try {
        const image_url = capture_video_frame({ video, frame })
        debug_camera("OCR_CAPTURE_COMPLETED", { reason })
        await on_capture_ref.current({ image_url, source: "camera_capture" })
      } catch (error) {
        console.error("[OCR_FLOW] OCR_CAPTURE_FAILED", enrich_ocr_debug_payload({
          component_instance_id: component_instance_id_ref.current,
          document_type,
          scan_state: flow_state_ref.current,
          camera_state: flow_state_ref.current,
          error_name: error instanceof Error ? error.name : "UnknownError",
          error_message: error instanceof Error ? error.message : String(error),
        }))
        stop_camera("capture_failed")
        emit_flow_event("flow_failed")
        on_failure_ref.current("capture_failed")
      }
    }, [debug_camera, document_type, emit_flow_event, frame, stop_camera])

    useEffect(() => {
      if (
        !camera_active ||
        capture_done_ref.current ||
        fallback_reason ||
        frozen_preview_url
      ) {
        return
      }

      const video = video_ref.current

      if (!video) {
        return
      }

      auto_capture_state_ref.current = {
        enabled_at: Date.now() + OCR_AUTO_CAPTURE_DELAY_MS,
        valid_frame_count: 0,
        stable_started_at: null,
      }

      debug_camera("OCR_AUTO_CAPTURE_DISABLED_INITIAL_DELAY", {
        delay_ms: OCR_AUTO_CAPTURE_DELAY_MS,
      })

      stop_auto_scan_ref.current?.()
      stop_auto_scan_ref.current = start_auto_scan({
        video,
        frame,
        on_quality: (next_quality) => {
          setQuality(next_quality)

          if (
            camera_ready_ref.current &&
            !detecting_started_ref.current &&
            (flow_state_ref.current === "camera_ready" ||
              flow_state_ref.current === "camera_starting")
          ) {
            detecting_started_ref.current = true
            emit_flow_event("detecting_started")
          }

          const decision = evaluate_auto_capture_frame({
            frame_result: next_quality,
            now: Date.now(),
            enabled_at: auto_capture_state_ref.current.enabled_at,
            valid_frame_count: auto_capture_state_ref.current.valid_frame_count,
            stable_started_at: auto_capture_state_ref.current.stable_started_at,
          })

          if (
            decision.ready_to_capture &&
            !ready_to_capture_emitted_ref.current
          ) {
            ready_to_capture_emitted_ref.current = true
            emit_flow_event("ready_to_capture")
          }

          setScanStatus(
            resolve_auto_scan_status({
              is_document_detected: next_quality.is_document_detected,
              is_edge_aligned: next_quality.is_edge_aligned,
              rejection: decision.rejection,
              ready_to_capture: decision.ready_to_capture,
            }),
          )

          if (decision.rejection === "not_in_guide") {
            debug_camera("OCR_FRAME_REJECTED_NOT_IN_GUIDE", {
              guidance_key: next_quality.guidance_key,
            })
          } else if (decision.rejection === "not_aligned") {
            debug_camera("OCR_FRAME_REJECTED_NOT_ALIGNED", {
              guidance_key: next_quality.guidance_key,
              guide_score: next_quality.guide_score,
              edge_alignment_score: next_quality.edge_alignment_score,
            })
          } else if (decision.rejection === "moving") {
            debug_camera("OCR_FRAME_REJECTED_MOVING", {
              guidance_key: next_quality.guidance_key,
            })
          } else if (decision.rejection === "blur") {
            debug_camera("OCR_FRAME_REJECTED_BLUR", {
              guidance_key: next_quality.guidance_key,
            })
          } else if (decision.rejection === "brightness") {
            debug_camera("OCR_FRAME_REJECTED_DARK", {
              guidance_key: next_quality.guidance_key,
            })
          } else if (decision.should_capture) {
            debug_camera("OCR_AUTO_CAPTURE_READY", {
              valid_frame_count: decision.valid_frame_count,
              stable_ms: decision.stable_ms,
            })
            void capture_once("auto_capture")
          }

          auto_capture_state_ref.current.valid_frame_count = decision.valid_frame_count
          auto_capture_state_ref.current.stable_started_at = decision.stable_started_at
        },
        is_cancelled: () => capture_done_ref.current,
      })

      return () => {
        stop_auto_scan_ref.current?.()
        stop_auto_scan_ref.current = null
      }
    }, [camera_active, capture_once, debug_camera, fallback_reason, frame, frozen_preview_url])

    async function handle_file_select(file: File) {
      debug_camera("OCR_CAPTURE_STARTED", { reason: "image_upload" })
      capture_done_ref.current = true
      emit_flow_event("capture_started")

      if (stream_ref.current || camera_starting_ref.current) {
        stop_auto_scan_ref.current?.()
        stop_auto_scan_ref.current = null
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

    const guidance = frozen_preview_url
      ? "読み取り中です"
      : scan_status

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
            ref={set_video_element}
            autoPlay
            playsInline
            muted
            onLoadedMetadata={handle_loaded_metadata}
            onCanPlay={handle_can_play}
            className="absolute inset-0 h-full w-full object-cover"
          />

          {frozen_preview_url ? (
            <img
              src={frozen_preview_url}
              alt="撮影した免許証"
              className="absolute inset-0 z-[1] h-full w-full object-cover"
            />
          ) : null}

          {!camera_active && !frozen_preview_url ? (
            <div
              className="pointer-events-none absolute inset-0 z-[2] bg-black/40"
              aria-hidden="true"
            />
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
        ) : null}
      </div>
    )
  },
)

function InactiveDocumentScanner({
  document_type,
}: Readonly<{ document_type: OcrDocumentType }>) {
  useEffect(() => {
    void send_ocr_debug("OCR_RENDER_BLOCKED_INACTIVE", {
      document_type,
      reason: "is_active_false",
    })
  }, [document_type])

  return null
}

const DocumentScanner = forwardRef<DocumentScannerHandle, DocumentScannerProps>(
  function DocumentScanner({ is_active = true, ...props }, ref) {
    if (!is_active) {
      return <InactiveDocumentScanner document_type={props.document_type} />
    }

    return <ActiveDocumentScanner ref={ref} is_active={is_active} {...props} />
  },
)

export default DocumentScanner
