import { stat } from "node:fs/promises"
import path from "node:path"

import {
  convert_directory,
  convert_file,
  WebpConvertError,
} from "@/core/image/webp"

function resolve_quality(argv: string[]) {
  const quality_flag = argv.find((value) => value.startsWith("--quality="))

  if (!quality_flag) {
    return 80
  }

  const parsed = Number(quality_flag.split("=")[1])

  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 100) {
    throw new WebpConvertError("Quality must be a number between 1 and 100")
  }

  return parsed
}

function resolve_target(argv: string[]) {
  const positional = argv.filter((value) => !value.startsWith("--"))
  return positional[0] ?? null
}

async function main() {
  const target = resolve_target(process.argv.slice(2))

  if (!target) {
    process.stderr.write(
      "Usage: pnpm image:webp <file|directory> [--quality=80]\n",
    )
    process.exit(1)
  }

  try {
    const quality = resolve_quality(process.argv.slice(2))
    const resolved_target = path.resolve(target)
    const target_stat = await stat(resolved_target)
    const results = target_stat.isDirectory()
      ? await convert_directory(resolved_target, { quality })
      : [await convert_file(resolved_target, { quality })]

    for (const result of results) {
      if (result.status === "skipped") {
        process.stdout.write(`skipped ${result.output_path}\n`)
        continue
      }

      process.stdout.write(`converted ${result.output_path}\n`)
    }
  } catch (error) {
    const message =
      error instanceof WebpConvertError
        ? error.message
        : error instanceof Error
          ? error.message
          : String(error)

    process.stderr.write(`${message}\n`)
    process.exit(1)
  }
}

void main()
