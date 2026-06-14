"use client"

import {
  getOverlayBackdropAnimationClass,
} from "@/components/overlay/animations"
import OverlayModal from "@/components/overlay/modal"
import type { OverlayAction, OverlayPhase } from "@/components/overlay/types"

function getOverlayPlacementClass(action: OverlayAction) {
  if (action.rule.placement === "bottom") {
    return [
      "items-end justify-center",
      "px-4 pt-[calc(20px+env(safe-area-inset-top,0px))]",
      "pb-[calc(12px+env(safe-area-inset-bottom,0px))]",
    ].join(" ")
  }

  if (action.rule.placement === "left") {
    return [
      "items-center justify-start",
      "pl-4 pr-8",
      "py-[calc(20px+env(safe-area-inset-top,0px))]",
      "pb-[calc(20px+env(safe-area-inset-bottom,0px))]",
    ].join(" ")
  }

  return [
    "items-start justify-center",
    "px-4 pt-[calc(20px+env(safe-area-inset-top,0px))]",
    "pb-[calc(20px+env(safe-area-inset-bottom,0px))]",
  ].join(" ")
}

function getOverlayContentClass(action: OverlayAction) {
  if (action.rule.placement === "left") {
    return "relative z-[1010] flex w-full justify-start"
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
      className={[
        "fixed inset-0 z-[1000] flex",
        getOverlayPlacementClass(action),
      ].join(" ")}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <div
        aria-hidden="true"
        className={[
          "absolute inset-0",
          getOverlayBackdropAnimationClass(phase),
        ].join(" ")}
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
          animation: overlay_backdrop_exit 220ms
            cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        .modal_bottom_enter {
          animation: modal_bottom_enter 480ms
            cubic-bezier(0.16, 1.2, 0.32, 1) both;
        }

        .modal_bottom_exit {
          animation: modal_bottom_exit 220ms
            cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        .modal_left_enter {
          animation: modal_left_enter 460ms
            cubic-bezier(0.16, 1.2, 0.32, 1) both;
        }

        .modal_left_exit {
          animation: modal_left_exit 220ms
            cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        .modal_float_enter {
          animation: modal_float_enter 440ms
            cubic-bezier(0.16, 1.16, 0.32, 1) both;
        }

        .modal_float_exit {
          animation: modal_float_exit 220ms
            cubic-bezier(0.22, 1, 0.36, 1) both;
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
          0% {
            opacity: 0;
            transform: translateY(72px) scale(0.96);
          }

          62% {
            transform: translateY(-6px) scale(1.015);
          }

          100% {
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
            transform: translateY(40px) scale(0.98);
          }
        }

        @keyframes modal_left_enter {
          0% {
            opacity: 0;
            transform: translateX(-72px) scale(0.96);
          }

          62% {
            transform: translateX(6px) scale(1.01);
          }

          100% {
            opacity: 1;
            transform: translateX(0) scale(1);
          }
        }

        @keyframes modal_left_exit {
          from {
            opacity: 1;
            transform: translateX(0) scale(1);
          }

          to {
            opacity: 0;
            transform: translateX(-40px) scale(0.98);
          }
        }

        @keyframes modal_float_enter {
          0% {
            opacity: 0;
            transform: translateY(48px) scale(0.97);
          }

          62% {
            transform: translateY(-4px) scale(1.01);
          }

          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes modal_float_exit {
          from {
            opacity: 1;
            transform: translateY(0) scale(1);
          }

          to {
            opacity: 0;
            transform: translateY(32px) scale(0.98);
          }
        }
      `}</style>
    </div>
  )
}
