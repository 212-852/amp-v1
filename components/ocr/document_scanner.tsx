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
  get_camera_permission_state,
  read_file_as_data_url,
  resolve_scanner_frame,
  start_auto_scan,
  start_camera_from_user_gesture,
  type FrameQualityResult,
  type FrameRect,
  type OcrCameraStartResult,
} from "@/core/ocr/camera"
import { read_camera_permission_denied_session } from "@/core/ocr/camera_debug"
import {
  OCR_AUTO_SCAN_TIMEOUT_MS,
  type OcrDocumentType,
} from "@/core/ocr/rules"

export type DocumentScannerStartResult = OcrCameraStartResult

export type DocumentScannerHandle = {
  open_from_user_gesture: () => Promise<DocumentScannerStartResult>
  start_camera: () => Promise<DocumentScannerStartResult>
}

type DocumentScannerProps = {
  document_type: OcrDocumentType
  on_capture: (image_url: string) => void
  disabled?: boolean
  expanded?: boolean
}

const DocumentScanner = forwardRef<DocumentScannerHandle, DocumentScannerProps>(
  function DocumentScanner(
    { document_type, on_capture, disabled = false, expanded = true },
    ref,
  ) {
    const container_ref = useRef<HTMLDivElement>(null)
    const video_ref = useRef<HTMLVideoElement>(null)
    const stream_ref = useRef<MediaStream | null>(null)
    const stable_since_ref = useRef<number | null>(null)
    const captured_ref = useRef(false)
    const stop_auto_scan_ref = useRef<(() => void) | null>(null)

    const [camera_active, setCameraActive] = useState(false)
    const [show_permission_button, setShowPermissionButton] = useState(
      () => get_camera_permission_state() === "unknown",
    )
    const [permission_fallback, setPermissionFallback] = useState(
      () => get_camera_permission_state() === "denied",
    )
    const [scan_timeout_fallback, setScanTimeoutFallback] = useState(false)
    const [frame, setFrame] = useState<FrameRect>({ x: 0, y: 0, width: 0, height: 0 })
    const [quality, setQuality] = useState<FrameQualityResult | null>(null)
    const [requesting_permission, setRequestingPermission] = useState(false)

    const stop_camera = useCallback(() => {
      stop_auto_scan_ref.current?.()
      stop_auto_scan_ref.current = null
      stream_ref.current?.getTracks().forEach((track) => track.stop())
      stream_ref.current = null
      setCameraActive(false)
    }, [])

    const attach_stream = useCallback(async (stream: MediaStream) => {
      stream_ref.current = stream
      const video = video_ref.current

      if (video) {
        video.srcObject = stream
        await video.play()
      }

      setCameraActive(true)
      setShowPermissionButton(false)
      setPermissionFallback(false)
      setScanTimeoutFallback(false)
    }, [])

    const enter_permission_fallback = useCallback(() => {
      stop_camera()
      setShowPermissionButton(false)
      setPermissionFallback(true)
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
          enter_permission_fallback()
        } else if (result.error) {
          stop_camera()
          setScanTimeoutFallback(true)
        }

        return result
      },
      [attach_stream, enter_permission_fallback, stop_camera],
    )

    const request_camera = useCallback(async (): Promise<DocumentScannerStartResult> => {
      if (disabled || captured_ref.current || permission_fallback) {
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
        enter_permission_fallback()
        return {
          started: false,
          stream: null,
          error: "カメラの許可が必要です",
          error_name: "NotAllowedError",
          error_message: "Permission denied",
          error_kind: "permission_denied",
        }
      }

      setRequestingPermission(true)
      captured_ref.current = false
      stable_since_ref.current = null

      try {
        const result = await start_camera_from_user_gesture({
          document_type,
          facing_mode: "environment",
        })

        return apply_camera_result(result)
      } finally {
        setRequestingPermission(false)
      }
    }, [
      apply_camera_result,
      disabled,
      document_type,
      enter_permission_fallback,
      permission_fallback,
    ])

    const open_from_user_gesture = useCallback(async () => {
      if (get_camera_permission_state() !== "granted") {
        return {
          started: false,
          stream: null,
          error: null,
          error_name: null,
          error_message: null,
          error_kind: null,
        }
      }

      return request_camera()
    }, [request_camera])

    useImperativeHandle(
      ref,
      () => ({
        open_from_user_gesture,
        start_camera: request_camera,
      }),
      [open_from_user_gesture, request_camera],
    )

    useEffect(() => {
      if (!expanded) {
        return
      }

      const permission_state = get_camera_permission_state()

      if (permission_state === "denied") {
        setPermissionFallback(true)
        setShowPermissionButton(false)
        setScanTimeoutFallback(false)
        return
      }

      if (permission_state === "unknown" && !camera_active && !captured_ref.current) {
        setPermissionFallback(false)
        setShowPermissionButton(true)
        setScanTimeoutFallback(false)
      }
    }, [camera_active, expanded])

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
        stop_camera()
      }
    }, [stop_camera])

    useEffect(() => {
      if (!camera_active || disabled || captured_ref.current || permission_fallback) {
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
          captured_ref.current = true
          stop_camera()
          on_capture(image_url)
        },
        is_cancelled: () => captured_ref.current,
      })

      return () => {
        stop_auto_scan_ref.current?.()
        stop_auto_scan_ref.current = null
      }
    }, [camera_active, disabled, frame, on_capture, permission_fallback, stop_camera])

    useEffect(() => {
      if (!camera_active || captured_ref.current || permission_fallback) {
        return
      }

      const timer = window.setTimeout(() => {
        if (captured_ref.current) {
          return
        }

        stop_camera()
        setScanTimeoutFallback(true)
      }, OCR_AUTO_SCAN_TIMEOUT_MS)

      return () => window.clearTimeout(timer)
    }, [camera_active, permission_fallback, stop_camera])

    async function handle_file_select(file: File) {
      captured_ref.current = true
      stop_camera()
      setScanTimeoutFallback(false)

      const image_url = await read_file_as_data_url(file)
      on_capture(image_url)
    }

    async function handle_file_input(event: ChangeEvent<HTMLInputElement>) {
      const file = event.target.files?.[0]

      if (!file) {
        return
      }

      await handle_file_select(file)
      event.target.value = ""
    }

    function handle_permission_button_click() {
      void request_camera()
    }

    const guidance = quality?.guidance_message ?? "枠内に合わせてください"

    if (permission_fallback) {
      return (
        <OcrCameraFallback
          disabled={disabled}
          on_file_select={handle_file_select}
        />
      )
    }

    return (
      <div className="space-y-3">
        <div
          ref={container_ref}
          className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-black"
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

        {show_permission_button ? (
          <button
            type="button"
            disabled={disabled || requesting_permission}
            onClick={handle_permission_button_click}
            className="h-12 w-full rounded-full bg-neutral-900 text-sm font-bold text-white disabled:opacity-60"
          >
            {requesting_permission ? "カメラを確認中..." : "カメラを許可して読み取る"}
          </button>
        ) : null}

        {scan_timeout_fallback ? (
          <div className="space-y-2">
            <p className="text-sm leading-6 text-neutral-600">
              自動スキャンできませんでした。画像を選択してください。
            </p>
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
          </div>
        ) : null}
      </div>
    )
  },
)

export default DocumentScanner
