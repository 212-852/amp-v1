import type { ReactNode } from "react"

import {
  form_error_message_class,
  form_label_class,
  resolveFieldClass,
} from "@/form/validation"

export default function FormField({
  label,
  error,
  className,
  baseFieldClass,
  children,
}: Readonly<{
  label: string
  error?: string
  className?: string
  baseFieldClass: string
  children: (fieldClass: string) => ReactNode
}>) {
  const fieldClass = resolveFieldClass(baseFieldClass, error)

  return (
    <label className={[form_label_class, className].filter(Boolean).join(" ")}>
      {label}
      {children(fieldClass)}
      {error ? (
        <span className={form_error_message_class} role="alert">
          {error}
        </span>
      ) : null}
    </label>
  )
}
