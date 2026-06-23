import type { CSSProperties, ReactNode } from "react"

type AppLayoutShellProps = Readonly<{
  children: ReactNode
  className?: string
  content_className?: string
  style?: CSSProperties
}>

export default function AppLayoutShell({
  children,
  className = "",
  content_className = "",
  style,
}: AppLayoutShellProps) {
  return (
    <div
      className={["flex min-h-dvh flex-col", className].filter(Boolean).join(" ")}
      style={style}
    >
      <div
        className={[
          "content_container flex min-h-0 w-full flex-1 flex-col",
          content_className,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {children}
      </div>
    </div>
  )
}
