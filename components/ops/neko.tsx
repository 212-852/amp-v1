type OpsNekoProps = {
  className?: string
}

export default function OpsNeko({
  className = "",
}: Readonly<OpsNekoProps>) {
  return (
    <div className={`robo_cat_area ${className}`.trim()} aria-hidden="true">
      <div className="robo_cat_frame">
        <div className="robo_cat_sprite" />
      </div>
    </div>
  )
}
