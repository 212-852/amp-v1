"use client"

import { getOverlayBackdropAnimationClass } from "@/components/overlay/animations"
import OverlayModal from "@/components/overlay/modal"
import type { OverlayAction, OverlayPhase } from "@/components/overlay/types"

function getOverlayPlacementClass(action: OverlayAction) {
  if (action.rule.placement === "bottom") {
    return "items-end justify-stretch"
  }

  if (action.rule.placement === "left") {
    return "items-stretch justify-start"
  }

  return "items-center justify-center"
}

function getOverlayContentClass(action: OverlayAction) {
  if (action.rule.placement === "bottom") {
    return "relative z-[1010] flex w-full"
  }

  if (action.rule.placement === "left") {
    return "relative z-[1010] flex h-full"
  }

  if (action.rule.placement === "center") {
    return "relative z-[1010] flex w-full justify-center px-5"
  }

  return "relative z-[1010] flex w-full justify-center"
}

export default function OverlayOutput({
  action,
  phase,
  onClose,
}: Readonly<{
  action: OverlayAction
  phase: OverlayPhase
  onClose: () => void
}>) {
  return (
    <div
      className={["fixed inset-0 z-[1000] flex", getOverlayPlacementClass(action)].join(
        " ",
      )}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <div
        aria-hidden="true"
        onMouseDown={onClose}
        className={["absolute inset-0", getOverlayBackdropAnimationClass(phase)].join(
          " ",
        )}
      />

      <div className={getOverlayContentClass(action)}>
        <OverlayModal
          rule={action.rule}
          phase={phase}
          onClose={onClose}
        />
      </div>

      <style jsx global>{`
        .overlay_backdrop_enter {
          animation: overlay_backdrop_enter 360ms
            cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        .overlay_backdrop_exit {
          animation: overlay_backdrop_exit 360ms
            cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        .modal_bottom_enter {
          animation: modal_bottom_enter 420ms
            cubic-bezier(0.16, 1.15, 0.32, 1) both;
        }

        .modal_bottom_exit {
          animation: modal_bottom_exit 420ms
            cubic-bezier(0.16, 1.15, 0.32, 1) both;
        }

        .modal_left_enter {
          animation: modal_left_enter 420ms
            cubic-bezier(0.16, 1.15, 0.32, 1) both;
        }

        .modal_left_exit {
          animation: modal_left_exit 420ms
            cubic-bezier(0.16, 1.15, 0.32, 1) both;
        }

        .modal_center_drop_bounce {
          animation: modal_center_drop_bounce 720ms linear both;
        }

        .modal_center_drop_bounce_exit {
          animation: modal_center_drop_bounce_exit 220ms ease-out both;
        }

        @keyframes overlay_backdrop_enter {
          from {
            opacity: 0;
            background: rgba(0, 0, 0, 0);
            backdrop-filter: blur(0);
          }

          to {
            opacity: 1;
            background: rgba(0, 0, 0, 0.34);
            backdrop-filter: blur(10px);
          }
        }

        @keyframes overlay_backdrop_exit {
          from {
            opacity: 1;
            background: rgba(0, 0, 0, 0.34);
            backdrop-filter: blur(10px);
          }

          to {
            opacity: 0;
            background: rgba(0, 0, 0, 0);
            backdrop-filter: blur(0);
          }
        }

        @keyframes modal_bottom_enter {
          from {
            opacity: 0;
            transform: translateY(100%) scale(0.98);
          }

          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes modal_bottom_exit {
          from {
            opacity: 1;
            transform: translateY(0) scale(1);
          }

          to {
            opacity: 0;
            transform: translateY(100%) scale(0.98);
          }
        }

        @keyframes modal_left_enter {
          from {
            opacity: 0;
            transform: translateX(-100%) scaleX(0.96);
          }

          to {
            opacity: 1;
            transform: translateX(0) scaleX(1);
          }
        }

        @keyframes modal_left_exit {
          from {
            opacity: 1;
            transform: translateX(0) scaleX(1);
          }

          to {
            opacity: 0;
            transform: translateX(-100%) scaleX(0.96);
          }
        }

        @keyframes modal_center_drop_bounce {
          0% {
            opacity: 0;
            transform: translate(-50%, -120%) scale(0.92);
          }

          45% {
            opacity: 1;
            transform: translate(-50%, -44%) scale(1.04);
          }

          60% {
            transform: translate(-50%, -56%) scale(0.98);
          }

          74% {
            transform: translate(-50%, -48%) scale(1.015);
          }

          86% {
            transform: translate(-50%, -51%) scale(0.995);
          }

          100% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
        }

        @keyframes modal_center_drop_bounce_exit {
          0% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }

          100% {
            opacity: 0;
            transform: translate(-50%, -68%) scale(0.96);
          }
        }
      `}</style>
    </div>
  )
}
