export default function AdminStatusDot({
  active = false,
}: Readonly<{ active?: boolean }>) {
  return (
    <span
      className={`h-2 w-2 rounded-full ${
        active ? "bg-[#8b5a2b]" : "bg-[#d9d9d9]"
      }`}
    />
  )
}
