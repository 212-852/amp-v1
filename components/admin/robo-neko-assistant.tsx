import Image from "next/image"

const assistantStates = ["idle", "thinking", "speaking", "notification"]

export default function RoboNekoAssistant() {
  return (
    <aside className="fixed bottom-[calc(84px+env(safe-area-inset-bottom,0px))] right-3 z-40 w-[172px] rounded-2xl border border-[#e5e5e5] bg-[#ffffff] p-3 shadow-[0_12px_28px_rgba(17,17,17,0.12)] md:bottom-6 md:right-6 md:w-[224px]">
      <div className="flex items-center gap-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-[#e5e5e5] bg-[#f5f5f5]">
          <Image
            src="/images/robo_neko.svg"
            alt="roboNeko"
            width={48}
            height={58}
            unoptimized
            className="h-12 w-12 object-contain"
          />
        </div>
        <div className="min-w-0">
          <p className="text-[12px] font-bold text-[#111111]">AI Assistant</p>
          <p className="mt-0.5 text-[10px] font-semibold leading-tight text-[#777777]">
            Operations / Dispatch / Support
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {assistantStates.map((state) => (
          <span
            key={state}
            className="rounded-full border border-[#e5e5e5] bg-[#ffffff] px-2 py-1 text-[10px] font-bold text-[#777777]"
          >
            {state}
          </span>
        ))}
      </div>
    </aside>
  )
}
