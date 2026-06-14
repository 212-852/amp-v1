import Image from "next/image"

export default function RoboNekoCharacter() {
  return (
    <Image
      src="/images/robo_neko.svg"
      alt="roboNeko"
      width={90}
      height={108}
      unoptimized
      className="h-[108px] w-[90px] object-contain"
    />
  )
}
