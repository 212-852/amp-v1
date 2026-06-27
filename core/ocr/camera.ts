import {
  OCR_AUTO_CAPTURE_REQUIRED_VALID_FRAMES,
  OCR_AUTO_CAPTURE_STABLE_MS,
  OCR_EDGE_ALIGNMENT_THRESHOLD,
  OCR_GUIDE_SCORE_THRESHOLD,
  resolve_guidance_message,
  type OcrDocumentType,
  OCR_FRAME_ASPECT,
  compute_document_frame,
} from "@/core/ocr/rules"
import {
  get_camera_permission_state,
  mark_camera_permission_denied_session,
  mark_camera_permission_granted_session,
  read_camera_permission_denied_session,
  resolve_ocr_camera_error_kind,
  send_ocr_debug,
  type CameraPermissionState,
  type OcrCameraErrorKind,
} from "@/core/ocr/debug"

export type { CameraPermissionState } from "@/core/ocr/debug"
export { get_camera_permission_state } from "@/core/ocr/debug"

const CAMERA_UNAVAILABLE_MESSAGE =
  "カメラを使用できません。画像を選択してください。"

const CAMERA_START_FAILED_MESSAGE =
  "カメラを起動できませんでした。画像を選択してください。"

export type FrameRect = {
  x: number
  y: number
  width: number
  height: number
}

export type FrameQualityIssue =
  | "document_missing"
  | "too_blurry"
  | "too_dark"
  | "too_bright"
  | "too_reflective"
  | "too_tilted"

export type FrameQualityResult = {
  score: number
  guide_score: number
  edge_alignment_score: number
  ready: boolean
  is_document_detected: boolean
  is_inside_guide_frame: boolean
  is_edge_aligned: boolean
  is_stable: boolean
  is_brightness_ok: boolean
  is_blur_ok: boolean
  issues: FrameQualityIssue[]
  guidance_key: string
  guidance_message: string
  frame_signature: number[]
}

export type OcrCameraStartInput = {
  document_type: OcrDocumentType
  facing_mode?: "environment" | "user"
}

export type OcrCameraStartResult = {
  started: boolean
  stream: MediaStream | null
  error: string | null
  error_name: string | null
  error_message: string | null
  error_kind: OcrCameraErrorKind | null
}

export type AutoCaptureFrameDecision = {
  should_capture: boolean
  rejection:
    | "initial_delay"
    | "not_in_guide"
    | "not_aligned"
    | "moving"
    | "blur"
    | "brightness"
    | null
  valid_frame_count: number
  stable_started_at: number | null
  stable_ms: number
  ready_to_capture: boolean
}

export function evaluate_auto_capture_frame(input: {
  frame_result: FrameQualityResult
  now: number
  enabled_at: number | null
  valid_frame_count: number
  stable_started_at: number | null
}): AutoCaptureFrameDecision {
  if (input.enabled_at == null || input.now < input.enabled_at) {
    return {
      should_capture: false,
      rejection: "initial_delay",
      valid_frame_count: 0,
      stable_started_at: null,
      stable_ms: 0,
      ready_to_capture: false,
    }
  }

  if (!input.frame_result.is_document_detected) {
    return {
      should_capture: false,
      rejection: "not_in_guide",
      valid_frame_count: 0,
      stable_started_at: null,
      stable_ms: 0,
      ready_to_capture: false,
    }
  }

  const rejection = !input.frame_result.is_inside_guide_frame
    ? "not_in_guide"
    : !input.frame_result.is_edge_aligned
      ? "not_aligned"
      : !input.frame_result.is_stable
        ? "moving"
        : !input.frame_result.is_blur_ok
          ? "blur"
          : !input.frame_result.is_brightness_ok
            ? "brightness"
            : input.frame_result.guide_score < OCR_GUIDE_SCORE_THRESHOLD
              ? "not_aligned"
              : null

  if (rejection) {
    return {
      should_capture: false,
      rejection,
      valid_frame_count: 0,
      stable_started_at: null,
      stable_ms: 0,
      ready_to_capture: false,
    }
  }

  const valid_frame_count = input.valid_frame_count + 1
  const stable_started_at = input.stable_started_at ?? input.now
  const stable_ms = input.now - stable_started_at
  const ready_to_capture =
    valid_frame_count >= OCR_AUTO_CAPTURE_REQUIRED_VALID_FRAMES &&
    stable_ms >= OCR_AUTO_CAPTURE_STABLE_MS

  return {
    should_capture: ready_to_capture,
    rejection: null,
    valid_frame_count,
    stable_started_at,
    stable_ms,
    ready_to_capture,
  }
}

function build_camera_debug_payload(input: {
  document_type: OcrDocumentType
  error_name?: string | null
  error_message?: string | null
  error_kind?: OcrCameraErrorKind | null
  permission_state?: CameraPermissionState
}) {
  const has_media_devices =
    typeof navigator !== "undefined" && Boolean(navigator.mediaDevices)
  const has_get_user_media =
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getUserMedia === "function"

  return {
    document_type: input.document_type,
    is_secure_context:
      typeof window !== "undefined" ? window.isSecureContext : false,
    has_media_devices,
    has_get_user_media,
    user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    error_name: input.error_name ?? null,
    error_message: input.error_message ?? null,
    error_kind: input.error_kind ?? null,
    permission_state: input.permission_state ?? get_camera_permission_state(),
  }
}

async function send_ocr_camera_failure_debug(input: {
  document_type: OcrDocumentType
  error_name: string
  error_message: string
  error_kind: OcrCameraErrorKind
}) {
  if (
    input.error_kind === "permission_denied" ||
    input.error_kind === "permission_dismissed"
  ) {
    await send_ocr_debug(
      "OCR_CAMERA_PERMISSION_DENIED",
      build_camera_debug_payload({
        document_type: input.document_type,
        error_name: input.error_name,
        error_message: input.error_message,
        error_kind: input.error_kind,
      }),
    )
  }
}

function resolve_camera_error_message(error_kind: OcrCameraErrorKind) {
  if (
    error_kind === "permission_denied" ||
    error_kind === "permission_dismissed"
  ) {
    return "カメラの許可が必要です"
  }

  if (error_kind === "unavailable") {
    return CAMERA_UNAVAILABLE_MESSAGE
  }

  return CAMERA_START_FAILED_MESSAGE
}

function build_get_user_media_request(input: OcrCameraStartInput) {
  return {
    audio: false,
    video: {
      facingMode: { ideal: input.facing_mode ?? "environment" },
      width: { ideal: 1920 },
      height: { ideal: 1080 },
    },
  } as const
}

export async function start_camera_from_user_gesture(
  input: OcrCameraStartInput,
): Promise<OcrCameraStartResult> {
  if (read_camera_permission_denied_session()) {
    const error_kind = "permission_denied" as const

    return {
      started: false,
      stream: null,
      error: resolve_camera_error_message(error_kind),
      error_name: "NotAllowedError",
      error_message: "Permission denied",
      error_kind,
    }
  }

  void send_ocr_debug(
    "OCR_CAMERA_PERMISSION_REQUESTED",
    build_camera_debug_payload({
      document_type: input.document_type,
      permission_state: get_camera_permission_state(),
    }),
  )

  try {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      throw new DOMException("mediaDevices.getUserMedia is unavailable", "NotSupportedError")
    }

    const stream = await navigator.mediaDevices.getUserMedia(
      build_get_user_media_request(input),
    )

    mark_camera_permission_granted_session()

    return {
      started: true,
      stream,
      error: null,
      error_name: null,
      error_message: null,
      error_kind: null,
    }
  } catch (error) {
    const error_name = error instanceof Error ? error.name : "UnknownError"
    const error_message = error instanceof Error ? error.message : String(error)
    const error_kind = resolve_ocr_camera_error_kind({
      error_name,
      error_message,
    })

    if (error_kind === "permission_denied") {
      mark_camera_permission_denied_session()
    }

    void send_ocr_camera_failure_debug({
      document_type: input.document_type,
      error_name,
      error_message,
      error_kind,
    })

    return {
      started: false,
      stream: null,
      error: resolve_camera_error_message(error_kind),
      error_name,
      error_message,
      error_kind,
    }
  }
}

/** @deprecated Use start_camera_from_user_gesture from a click handler. */
export async function start_ocr_camera(
  input: OcrCameraStartInput,
): Promise<OcrCameraStartResult> {
  return start_camera_from_user_gesture(input)
}

export function start_auto_scan(input: {
  video: HTMLVideoElement
  frame: FrameRect
  on_quality: (quality: FrameQualityResult) => void
  is_cancelled?: () => boolean
}) {
  let animation_id = 0
  let last_sample_at = 0
  let previous_signature: number[] | null = null

  const tick = (now: number) => {
    if (input.is_cancelled?.()) {
      return
    }

    if (
      now - last_sample_at >= 100 &&
      input.video.readyState >= 2 &&
      input.frame.width > 0
    ) {
      last_sample_at = now
      const sampled = sample_video_frame_quality({
        video: input.video,
        frame: input.frame,
      })
      const motion_score = previous_signature
        ? sampled.frame_signature.reduce((sum, value, index) => {
            return sum + Math.abs(value - (previous_signature?.[index] ?? value))
          }, 0) / Math.max(1, sampled.frame_signature.length)
        : Number.POSITIVE_INFINITY

      previous_signature = sampled.frame_signature
      input.on_quality({
        ...sampled,
        is_stable: motion_score <= 5,
      })
    }

    animation_id = window.requestAnimationFrame(tick)
  }

  animation_id = window.requestAnimationFrame(tick)

  return () => {
    window.cancelAnimationFrame(animation_id)
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function luminance(r: number, g: number, b: number) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function sample_frame_pixels(image_data: ImageData, frame: FrameRect) {
  const { data, width } = image_data
  const left = clamp(Math.floor(frame.x), 0, width - 1)
  const top = clamp(Math.floor(frame.y), 0, image_data.height - 1)
  const right = clamp(Math.floor(frame.x + frame.width), left + 1, width)
  const bottom = clamp(Math.floor(frame.y + frame.height), top + 1, image_data.height)

  let brightness_sum = 0
  let bright_pixel_count = 0
  let edge_sum = 0
  let count = 0
  const grayscale: number[] = []

  for (let y = top; y < bottom; y += 2) {
    for (let x = left; x < right; x += 2) {
      const index = (y * width + x) * 4
      const r = data[index] ?? 0
      const g = data[index + 1] ?? 0
      const b = data[index + 2] ?? 0
      const lum = luminance(r, g, b)

      brightness_sum += lum
      if (lum > 245) {
        bright_pixel_count += 1
      }

      grayscale.push(lum)
      count += 1
    }
  }

  const step = Math.max(1, Math.floor(Math.sqrt(grayscale.length)))
  for (let i = 0; i < grayscale.length - step; i += step) {
    const current = grayscale[i] ?? 0
    const right_pixel = grayscale[i + 1] ?? current
    const down_pixel = grayscale[i + step] ?? current
    edge_sum += Math.abs(current - right_pixel) + Math.abs(current - down_pixel)
  }

  const average_brightness = count > 0 ? brightness_sum / count : 0
  const edge_density = count > 0 ? edge_sum / count : 0
  const glare_ratio = count > 0 ? bright_pixel_count / count : 0

  let laplacian_sum = 0
  let laplacian_count = 0
  const quadrant_laplacian_sum = [0, 0, 0, 0]
  const quadrant_laplacian_count = [0, 0, 0, 0]
  const center_x = left + (right - left) / 2
  const center_y = top + (bottom - top) / 2

  for (let y = top + 1; y < bottom - 1; y += 2) {
    for (let x = left + 1; x < right - 1; x += 2) {
      const center = luminance(
        data[(y * width + x) * 4] ?? 0,
        data[(y * width + x) * 4 + 1] ?? 0,
        data[(y * width + x) * 4 + 2] ?? 0,
      )
      const up = luminance(
        data[((y - 1) * width + x) * 4] ?? 0,
        data[((y - 1) * width + x) * 4 + 1] ?? 0,
        data[((y - 1) * width + x) * 4 + 2] ?? 0,
      )
      const down = luminance(
        data[((y + 1) * width + x) * 4] ?? 0,
        data[((y + 1) * width + x) * 4 + 1] ?? 0,
        data[((y + 1) * width + x) * 4 + 2] ?? 0,
      )
      const left_px = luminance(
        data[(y * width + (x - 1)) * 4] ?? 0,
        data[(y * width + (x - 1)) * 4 + 1] ?? 0,
        data[(y * width + (x - 1)) * 4 + 2] ?? 0,
      )
      const right_px = luminance(
        data[(y * width + (x + 1)) * 4] ?? 0,
        data[(y * width + (x + 1)) * 4 + 1] ?? 0,
        data[(y * width + (x + 1)) * 4 + 2] ?? 0,
      )
      const laplacian = Math.abs(4 * center - up - down - left_px - right_px)
      laplacian_sum += laplacian
      laplacian_count += 1
      const quadrant = (y >= center_y ? 2 : 0) + (x >= center_x ? 1 : 0)
      quadrant_laplacian_sum[quadrant] =
        (quadrant_laplacian_sum[quadrant] ?? 0) + laplacian
      quadrant_laplacian_count[quadrant] =
        (quadrant_laplacian_count[quadrant] ?? 0) + 1
    }
  }

  const blur_score = laplacian_count > 0 ? laplacian_sum / laplacian_count : 0
  const document_coverage_ratio = quadrant_laplacian_sum.filter((sum, index) => {
    const quadrant_count = quadrant_laplacian_count[index] ?? 0
    return quadrant_count > 0 && sum / quadrant_count >= 6
  }).length / 4

  return {
    average_brightness,
    edge_density,
    glare_ratio,
    blur_score,
    document_coverage_ratio,
    frame_signature: Array.from({ length: 64 }, (_, index) => {
      const signature_index = Math.min(
        grayscale.length - 1,
        Math.floor((index / 64) * grayscale.length),
      )
      return grayscale[Math.max(0, signature_index)] ?? 0
    }),
  }
}

function resolve_primary_issue(issues: FrameQualityIssue[]): string {
  if (issues.includes("document_missing")) {
    return "document_missing"
  }

  if (issues.includes("too_blurry")) {
    return "reduce_blur"
  }

  if (issues.includes("too_dark")) {
    return "increase_light"
  }

  if (issues.includes("too_reflective")) {
    return "reduce_glare"
  }

  if (issues.includes("too_tilted")) {
    return "align_frame"
  }

  if (issues.includes("too_bright")) {
    return "reduce_glare"
  }

  return "hold_steady"
}

export function evaluate_frame_quality(
  image_data: ImageData,
  frame: FrameRect,
): FrameQualityResult {
  const metrics = sample_frame_pixels(image_data, frame)
  const issues: FrameQualityIssue[] = []

  if (metrics.edge_density < 8 || metrics.document_coverage_ratio < 0.75) {
    issues.push("document_missing")
  }

  if (metrics.blur_score < 12) {
    issues.push("too_blurry")
  }

  if (metrics.average_brightness < 70) {
    issues.push("too_dark")
  }

  if (metrics.average_brightness > 215) {
    issues.push("too_bright")
  }

  if (metrics.glare_ratio > 0.08) {
    issues.push("too_reflective")
  }

  if (metrics.edge_density > 8 && metrics.blur_score > 12) {
    const horizontal_bias = Math.abs(metrics.edge_density - metrics.blur_score)

    if (horizontal_bias > 40) {
      issues.push("too_tilted")
    }
  }

  let score = 1

  if (issues.includes("document_missing")) score -= 0.35
  if (issues.includes("too_blurry")) score -= 0.25
  if (issues.includes("too_dark")) score -= 0.2
  if (issues.includes("too_bright")) score -= 0.15
  if (issues.includes("too_reflective")) score -= 0.2
  if (issues.includes("too_tilted")) score -= 0.15

  score = clamp(score, 0, 1)

  const is_document_detected =
    metrics.document_coverage_ratio >= 0.75 && metrics.edge_density >= 8
  const edge_alignment_score = clamp(metrics.document_coverage_ratio, 0, 1)
  const is_edge_aligned =
    edge_alignment_score >= OCR_EDGE_ALIGNMENT_THRESHOLD &&
    !issues.includes("too_tilted")
  const guide_score = score

  const guidance_key =
    guide_score >= OCR_GUIDE_SCORE_THRESHOLD
      ? "hold_steady"
      : resolve_primary_issue(issues)

  return {
    score,
    guide_score,
    edge_alignment_score,
    ready: guide_score >= OCR_GUIDE_SCORE_THRESHOLD && is_edge_aligned,
    is_document_detected,
    is_inside_guide_frame:
      is_document_detected && !issues.includes("too_tilted"),
    is_edge_aligned,
    is_stable: false,
    is_brightness_ok:
      !issues.includes("too_dark") &&
      !issues.includes("too_bright") &&
      !issues.includes("too_reflective"),
    is_blur_ok: !issues.includes("too_blurry"),
    issues,
    guidance_key,
    guidance_message: resolve_guidance_message(guidance_key),
    frame_signature: metrics.frame_signature,
  }
}

export function resolve_scanner_frame(
  document_type: OcrDocumentType,
  viewport_width: number,
  viewport_height: number,
) {
  return compute_document_frame({
    viewport_width,
    viewport_height,
    aspect_ratio: OCR_FRAME_ASPECT[document_type],
  })
}

export async function read_file_as_data_url(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      resolve(typeof reader.result === "string" ? reader.result : "")
    }

    reader.onerror = () => reject(new Error("Failed to read image file"))
    reader.readAsDataURL(file)
  })
}

function map_display_frame_to_video(
  video: HTMLVideoElement,
  frame: FrameRect,
): FrameRect {
  const display_width = video.clientWidth
  const display_height = video.clientHeight

  if (
    display_width <= 0 ||
    display_height <= 0 ||
    video.videoWidth <= 0 ||
    video.videoHeight <= 0
  ) {
    return { x: 0, y: 0, width: 0, height: 0 }
  }

  const cover_scale = Math.max(
    display_width / video.videoWidth,
    display_height / video.videoHeight,
  )
  const rendered_width = video.videoWidth * cover_scale
  const rendered_height = video.videoHeight * cover_scale
  const crop_x = (rendered_width - display_width) / 2
  const crop_y = (rendered_height - display_height) / 2
  const x = clamp((frame.x + crop_x) / cover_scale, 0, video.videoWidth - 1)
  const y = clamp((frame.y + crop_y) / cover_scale, 0, video.videoHeight - 1)

  return {
    x,
    y,
    width: clamp(frame.width / cover_scale, 1, video.videoWidth - x),
    height: clamp(frame.height / cover_scale, 1, video.videoHeight - y),
  }
}

export function capture_video_frame(input: {
  video: HTMLVideoElement
  frame: FrameRect
}) {
  const source_frame = map_display_frame_to_video(input.video, input.frame)

  if (source_frame.width <= 0 || source_frame.height <= 0) {
    throw new Error("Video frame is not ready")
  }

  const canvas = document.createElement("canvas")
  canvas.width = Math.floor(source_frame.width)
  canvas.height = Math.floor(source_frame.height)

  const context = canvas.getContext("2d")

  if (!context) {
    throw new Error("Canvas is unavailable")
  }

  context.drawImage(
    input.video,
    source_frame.x,
    source_frame.y,
    source_frame.width,
    source_frame.height,
    0,
    0,
    source_frame.width,
    source_frame.height,
  )

  return canvas.toDataURL("image/jpeg", 0.92)
}

export function sample_video_frame_quality(input: {
  video: HTMLVideoElement
  frame: FrameRect
}) {
  const source_frame = map_display_frame_to_video(input.video, input.frame)

  if (source_frame.width <= 0 || source_frame.height <= 0) {
    return {
      score: 0,
      guide_score: 0,
      edge_alignment_score: 0,
      ready: false,
      is_document_detected: false,
      is_inside_guide_frame: false,
      is_edge_aligned: false,
      is_stable: false,
      is_brightness_ok: false,
      is_blur_ok: false,
      issues: ["document_missing"] as FrameQualityIssue[],
      guidance_key: "align_frame",
      guidance_message: resolve_guidance_message("align_frame"),
      frame_signature: [],
    } satisfies FrameQualityResult
  }

  const canvas = document.createElement("canvas")
  canvas.width = Math.min(480, Math.max(1, Math.floor(source_frame.width)))
  canvas.height = Math.max(
    1,
    Math.floor(canvas.width * (source_frame.height / source_frame.width)),
  )

  const context = canvas.getContext("2d")

  if (
    !context ||
    canvas.width === 0 ||
    canvas.height === 0
  ) {
    return {
      score: 0,
      guide_score: 0,
      edge_alignment_score: 0,
      ready: false,
      is_document_detected: false,
      is_inside_guide_frame: false,
      is_edge_aligned: false,
      is_stable: false,
      is_brightness_ok: false,
      is_blur_ok: false,
      issues: ["document_missing"] as FrameQualityIssue[],
      guidance_key: "align_frame",
      guidance_message: resolve_guidance_message("align_frame"),
      frame_signature: [],
    } satisfies FrameQualityResult
  }

  context.drawImage(
    input.video,
    source_frame.x,
    source_frame.y,
    source_frame.width,
    source_frame.height,
    0,
    0,
    canvas.width,
    canvas.height,
  )
  const image_data = context.getImageData(0, 0, canvas.width, canvas.height)

  return evaluate_frame_quality(image_data, {
    x: 0,
    y: 0,
    width: canvas.width,
    height: canvas.height,
  })
}
