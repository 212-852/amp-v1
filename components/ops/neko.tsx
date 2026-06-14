import Image from "next/image"

type OpsNekoProps = {
  className?: string
}

export default function OpsNeko({
  className = "h-[124px] w-[96px] object-contain object-top",
}: Readonly<OpsNekoProps>) {
  return (
    <Image
      src="/images/robo_neko.svg"
      alt="roboNeko"
      width={96}
      height={124}
      unoptimized
      className={className}
    />
  )
}
