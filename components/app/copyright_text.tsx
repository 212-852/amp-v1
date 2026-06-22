export const app_copyright_text = "© 2026 Wan Da Nya Inc."

export default function AppCopyrightText({
  className,
}: Readonly<{
  className?: string
}>) {
  return <p className={className}>{app_copyright_text}</p>
}
