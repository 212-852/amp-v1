import { existsSync } from "node:fs"
import { readdir } from "node:fs/promises"
import path from "node:path"

import sharp from "sharp"

export type WebpConvertOptions = {
  quality?: number
}

export type WebpConvertResult = {
  input_path: string
  output_path: string
  status: "converted" | "skipped"
}

export class WebpConvertError extends Error {
  readonly cause_error: unknown

  constructor(message: string, cause_error?: unknown) {
    super(message)
    this.name = "WebpConvertError"
    this.cause_error = cause_error
  }
}

const convertible_extensions = new Set([".jpg", ".jpeg", ".png"])

export function resolve_webp_output_path(input_path: string) {
  const parsed = path.parse(input_path)
  return path.join(parsed.dir, `${parsed.name}.webp`)
}

export function is_convertible_image_path(file_path: string) {
  return convertible_extensions.has(path.extname(file_path).toLowerCase())
}

export async function convert_file(
  input_path: string,
  options: WebpConvertOptions = {},
): Promise<WebpConvertResult> {
  const quality = options.quality ?? 80
  const resolved_input = path.resolve(input_path)
  const output_path = resolve_webp_output_path(resolved_input)

  if (!is_convertible_image_path(resolved_input)) {
    throw new WebpConvertError(`Unsupported file type: ${resolved_input}`)
  }

  if (!existsSync(resolved_input)) {
    throw new WebpConvertError(`File not found: ${resolved_input}`)
  }

  if (existsSync(output_path)) {
    return {
      input_path: resolved_input,
      output_path,
      status: "skipped",
    }
  }

  try {
    await sharp(resolved_input).webp({ quality }).toFile(output_path)
    return {
      input_path: resolved_input,
      output_path,
      status: "converted",
    }
  } catch (error) {
    throw new WebpConvertError(
      `Failed to convert ${resolved_input}`,
      error,
    )
  }
}

export async function convert_directory(
  directory_path: string,
  options: WebpConvertOptions = {},
): Promise<WebpConvertResult[]> {
  const resolved_dir = path.resolve(directory_path)
  const entries = await readdir(resolved_dir, { withFileTypes: true })
  const results: WebpConvertResult[] = []

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue
    }

    const input_path = path.join(resolved_dir, entry.name)

    if (!is_convertible_image_path(input_path)) {
      continue
    }

    try {
      results.push(await convert_file(input_path, options))
    } catch (error) {
      throw new WebpConvertError(
        `Directory conversion failed at ${input_path}`,
        error,
      )
    }
  }

  return results
}
