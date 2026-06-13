import Link from "next/link"

type HeaderProps = {
  title: string
}

export default function Header({ title }: HeaderProps) {
  return (
    <header className="border-b border-neutral-200 bg-white">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
        <Link className="text-sm font-semibold text-neutral-950" href="/">
          AMP
        </Link>
        <p className="text-sm font-medium text-neutral-600">{title}</p>
      </div>
    </header>
  )
}
