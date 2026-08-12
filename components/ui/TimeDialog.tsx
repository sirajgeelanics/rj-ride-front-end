"use client";

import React, { useRef, useState } from "react";

interface TimeDialogProps {
  initialHour: number; // 0-23
  initialMinute: number; // 0-59
  onConfirm: (hour: number, minute: number) => void;
  onClose: () => void;
  title?: string;
}

const CLOCK_SIZE = 220;
const CLOCK_RADIUS = CLOCK_SIZE / 2;
const NUMBER_RADIUS = CLOCK_RADIUS - 28;
const NUMBER_BTN = 36;

function polarToXY(angleDeg: number, radius: number) {
  const rad = (angleDeg - 90) * (Math.PI / 180);
  return {
    x: CLOCK_RADIUS + radius * Math.cos(rad),
    y: CLOCK_RADIUS + radius * Math.sin(rad),
  };
}

/** Angle in degrees from the clock centre, 0 = 12 o'clock, increasing clockwise. */
function angleFromXY(x: number, y: number): number {
  let angle = Math.atan2(y, x) * (180 / Math.PI) + 90;
  if (angle < 0) angle += 360;
  return angle;
}

/**
 * Centered Material-style time picker: large HH:MM header with AM/PM, and an analog dial whose
 * hand can be dragged or tapped. Picking an hour advances automatically to minutes.
 */
export const TimeDialog: React.FC<TimeDialogProps> = ({
  initialHour,
  initialMinute,
  onConfirm,
  onClose,
  title = "SELECT TIME",
}) => {
  const [hour24, setHour24] = useState(initialHour);
  const [minute, setMinute] = useState(initialMinute);
  const [mode, setMode] = useState<"hour" | "minute">("hour");
  const clockRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const isPM = hour24 >= 12;
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;

  const setFromAngle = (angle: number) => {
    if (mode === "hour") {
      let h = Math.round(angle / 30) % 12;
      if (h === 0) h = 12;
      setHour24(isPM ? (h === 12 ? 12 : h + 12) : h === 12 ? 0 : h);
    } else {
      setMinute(Math.round(angle / 6) % 60);
    }
  };

  const handlePointer = (e: React.PointerEvent) => {
    if (!clockRef.current) return;
    const rect = clockRef.current.getBoundingClientRect();
    setFromAngle(
      angleFromXY(e.clientX - rect.left - CLOCK_RADIUS, e.clientY - rect.top - CLOCK_RADIUS),
    );
  };

  const toggleAMPM = (pm: boolean) => {
    if (pm === isPM) return;
    setHour24((h) => (pm ? (h + 12) % 24 : (h - 12 + 24) % 24));
  };

  const numbers =
    mode === "hour"
      ? Array.from({ length: 12 }, (_, i) => ({ value: i === 0 ? 12 : i, angle: i * 30 }))
      : Array.from({ length: 12 }, (_, i) => ({ value: i * 5, angle: i * 30 }));

  const nearestFive = (Math.round(minute / 5) * 5) % 60;
  const handAngle = mode === "hour" ? (hour12 % 12) * 30 : minute * 6;
  const handPos = polarToXY(handAngle, NUMBER_RADIUS);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#072D62]/40 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-2xl shadow-xl w-[330px] overflow-hidden">
        <div className="bg-brand-blue px-6 py-5">
          <p className="text-white/70 text-[11px] font-semibold tracking-wide mb-2">{title}</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMode("hour")}
              className={`px-2 py-1 rounded-md text-4xl font-bold transition-colors ${
                mode === "hour" ? "bg-white/20 text-white" : "text-white/50"
              }`}
            >
              {String(hour12).padStart(2, "0")}
            </button>
            <span className="text-4xl font-bold text-white">:</span>
            <button
              type="button"
              onClick={() => setMode("minute")}
              className={`px-2 py-1 rounded-md text-4xl font-bold transition-colors ${
                mode === "minute" ? "bg-white/20 text-white" : "text-white/50"
              }`}
            >
              {String(minute).padStart(2, "0")}
            </button>
            <div className="flex flex-col ml-2 gap-1">
              <button
                type="button"
                onClick={() => toggleAMPM(false)}
                className={`px-2 py-0.5 rounded text-xs font-bold border transition-colors ${
                  !isPM
                    ? "bg-white text-brand-blue border-white"
                    : "text-white/70 border-white/40 hover:bg-white/10"
                }`}
              >
                AM
              </button>
              <button
                type="button"
                onClick={() => toggleAMPM(true)}
                className={`px-2 py-0.5 rounded text-xs font-bold border transition-colors ${
                  isPM
                    ? "bg-white text-brand-blue border-white"
                    : "text-white/70 border-white/40 hover:bg-white/10"
                }`}
              >
                PM
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center py-6">
          <div
            ref={clockRef}
            onPointerDown={(e) => {
              draggingRef.current = true;
              handlePointer(e);
            }}
            onPointerMove={(e) => draggingRef.current && handlePointer(e)}
            onPointerUp={(e) => {
              if (!draggingRef.current) return;
              handlePointer(e);
              draggingRef.current = false;
              if (mode === "hour") setMode("minute");
            }}
            className="relative rounded-full bg-gray-100 select-none"
            style={{ width: CLOCK_SIZE, height: CLOCK_SIZE, touchAction: "none", cursor: "pointer" }}
          >
            <div
              className="absolute bg-brand-blue pointer-events-none"
              style={{
                width: 2,
                height: NUMBER_RADIUS,
                left: CLOCK_RADIUS - 1,
                top: CLOCK_RADIUS - NUMBER_RADIUS,
                transformOrigin: `1px ${NUMBER_RADIUS}px`,
                transform: `rotate(${handAngle}deg)`,
              }}
            />
            <div
              className="absolute w-2 h-2 rounded-full bg-brand-blue pointer-events-none"
              style={{ left: CLOCK_RADIUS - 4, top: CLOCK_RADIUS - 4 }}
            />
            <div
              className="absolute rounded-full bg-brand-blue/90 pointer-events-none"
              style={{
                width: NUMBER_BTN,
                height: NUMBER_BTN,
                left: handPos.x - NUMBER_BTN / 2,
                top: handPos.y - NUMBER_BTN / 2,
              }}
            />

            {numbers.map(({ value, angle }) => {
              const pos = polarToXY(angle, NUMBER_RADIUS);
              const isSelected = mode === "hour" ? value === hour12 : value === nearestFive;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setFromAngle(angle);
                    if (mode === "hour") setMode("minute");
                  }}
                  className={`absolute rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                    isSelected ? "text-white" : "text-gray-700 hover:bg-gray-200"
                  }`}
                  style={{
                    width: NUMBER_BTN,
                    height: NUMBER_BTN,
                    left: pos.x - NUMBER_BTN / 2,
                    top: pos.y - NUMBER_BTN / 2,
                    zIndex: isSelected ? 5 : 1,
                  }}
                >
                  {String(value).padStart(2, "0")}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-end gap-1 px-3 pb-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-bold text-brand-blue hover:bg-brand-blue/10 rounded-lg transition-colors"
          >
            CANCEL
          </button>
          <button
            type="button"
            onClick={() => onConfirm(hour24, minute)}
            className="px-4 py-2 text-sm font-bold text-brand-blue hover:bg-brand-blue/10 rounded-lg transition-colors"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

TimeDialog.displayName = "TimeDialog";
