export default function PartnerHero() {
  return (
    <div className="relative aspect-[20/13] w-full overflow-hidden rounded-[20px] bg-[#ead7c3]">
      <picture className="block h-full w-full">
        <source srcSet="/images/recruit.webp" type="image/webp" />
        <img
          src="/images/recruit.jpg"
          alt="パートナードライバー募集"
          className="h-full w-full object-cover"
        />
      </picture>
    </div>
  )
}
