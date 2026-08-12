"use client";

import React from "react";
import { Smartphone, Wifi, Battery, Signal } from "lucide-react";

interface MobileFrameProps {
  children: React.ReactNode;
  title?: string;
}

export const MobileFrame: React.FC<MobileFrameProps> = ({ children, title = "RIDE Driver" }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-full py-8">
      {/* Phone frame */}
      <div className="relative w-[390px] h-[844px] max-h-[90vh] bg-[#072D62] rounded-[48px] shadow-2xl border-[3px] border-gray-700 overflow-hidden">
        {/* Notch area */}
        <div className="absolute top-0 left-0 right-0 z-20">
          {/* Status bar */}
          <div className="flex items-center justify-between px-8 pt-3 pb-1">
            <span className="text-xs font-semibold text-white/80">9:41</span>
            <div className="flex items-center gap-1.5">
              <Signal className="w-3.5 h-3.5 text-white/80" />
              <Wifi className="w-3.5 h-3.5 text-white/80" />
              <Battery className="w-5 h-3.5 text-white/80" />
            </div>
          </div>

          {/* Notch */}
          <div className="flex justify-center">
            <div className="w-[120px] h-[30px] bg-[#072D62] rounded-b-2xl flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-gray-700" />
            </div>
          </div>
        </div>

        {/* App content area */}
        <div className="absolute inset-0 top-[48px] bottom-[8px] left-[2px] right-[2px] rounded-[40px] overflow-hidden bg-white">
          {/* App header */}
          <div className="bg-[#072D62] px-4 pt-2 pb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-[#B23457] flex items-center justify-center">
                <span className="text-white text-xs font-bold">R</span>
              </div>
              <span className="text-white text-sm font-semibold">{title}</span>
            </div>
            <div className="flex items-center gap-1">
              <Signal className="w-3 h-3 text-white/60" />
              <span className="text-[10px] text-white/60">4G</span>
              <Battery className="w-4 h-3 text-white/60" />
            </div>
          </div>

          {/* Scrollable content */}
          <div className="h-[calc(100%-44px)] overflow-y-auto custom-scrollbar bg-[#F7F5F3]">
            {children}
          </div>
        </div>

        {/* Home indicator */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20">
          <div className="w-[134px] h-[5px] bg-white/60 rounded-full" />
        </div>
      </div>

      {/* Label */}
      <p className="text-xs text-text-secondary mt-4 flex items-center gap-2">
        <Smartphone className="w-3 h-3" />
        Driver Mobile App Simulation
      </p>
    </div>
  );
};

MobileFrame.displayName = "MobileFrame";
