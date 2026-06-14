import Image from "next/image"

export default function OpsNeko() {
  return (
    <Image
      src="/images/robo_neko.svg"
      alt="roboNeko"
      width={112}
      height={144}
      unoptimized
      className="h-[144px] w-[112px] object-contain object-top"
    />
  )
}
