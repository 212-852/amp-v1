export default function PartnerHero() {
  return (
    <div className="w-full bg-[#f5e8d5]">
      <picture className="block w-full">
        <source srcSet="/images/recruit.webp" type="image/webp" />
        <img
          src="/images/recruit.jpg"
          alt="パートナードライバー募集"
          className="block h-auto w-full object-contain"
        />
      </picture>
    </div>
  )
}
