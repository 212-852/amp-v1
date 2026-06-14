import OpsShell from "@/components/ops/shell"

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return <OpsShell>{children}</OpsShell>
}
