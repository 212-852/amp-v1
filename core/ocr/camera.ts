import {
  OCR_AUTO_CAPTURE_MIN_SCORE,
  resolve_guidance_message,
  type OcrDocumentType,
  OCR_FRAME_ASPECT,
  compute_document_frame,
} from "@/core/ocr/rules"

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
  ready: boolean
  issues: FrameQualityIssue[]
  guidance_key: string
  guidance_message: string
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
    }
  }

  const blur_score = laplacian_count > 0 ? laplacian_sum / laplacian_count : 0

  return {
    average_brightness,
    edge_density,
    glare_ratio,
    blur_score,
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

  if (metrics.edge_density < 8) {
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

  const guidance_key =
    score >= OCR_AUTO_CAPTURE_MIN_SCORE
      ? "hold_steady"
      : resolve_primary_issue(issues)

  return {
    score,
    ready: score >= OCR_AUTO_CAPTURE_MIN_SCORE,
    issues,
    guidance_key,
    guidance_message: resolve_guidance_message(guidance_key),
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

export function capture_video_frame(input: {
  video: HTMLVideoElement
  frame: FrameRect
}) {
  const canvas = document.createElement("canvas")
  canvas.width = Math.floor(input.frame.width)
  canvas.height = Math.floor(input.frame.height)

  const context = canvas.getContext("2d")

  if (!context) {
    throw new Error("Canvas is unavailable")
  }

  context.drawImage(
    input.video,
    input.frame.x,
    input.frame.y,
    input.frame.width,
    input.frame.height,
    0,
    0,
    input.frame.width,
    input.frame.height,
  )

  return canvas.toDataURL("image/jpeg", 0.92)
}

export function sample_video_frame_quality(input: {
  video: HTMLVideoElement
  frame: FrameRect
}) {
  const canvas = document.createElement("canvas")
  canvas.width = input.video.videoWidth
  canvas.height = input.video.videoHeight

  const context = canvas.getContext("2d")

  if (!context || canvas.width === 0 || canvas.height === 0) {
    return {
      score: 0,
      ready: false,
      issues: ["document_missing"] as FrameQualityIssue[],
      guidance_key: "align_frame",
      guidance_message: resolve_guidance_message("align_frame"),
    } satisfies FrameQualityResult
  }

  context.drawImage(input.video, 0, 0, canvas.width, canvas.height)
  const image_data = context.getImageData(0, 0, canvas.width, canvas.height)

  const scale_x = canvas.width / input.video.clientWidth
  const scale_y = canvas.height / input.video.clientHeight

  return evaluate_frame_quality(image_data, {
    x: input.frame.x * scale_x,
    y: input.frame.y * scale_y,
    width: input.frame.width * scale_x,
    height: input.frame.height * scale_y,
  })
}
