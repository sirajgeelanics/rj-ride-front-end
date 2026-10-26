import React, { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { keys } from "@/lib/shared";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Play, Pause, RotateCcw } from "lucide-react";
import { dynamic } from "@/lib/router";
import type { ReplayPoint } from "@/components/trips/TripReplayMap";

const TripReplayMap = dynamic(() => import("@/components/trips/TripReplayMap"), {
  ssr: false,
  loading: () => (
    <div className="h-72 skeleton flex items-center justify-center text-text-secondary text-sm">
      Loading map…
    </div>
  ),
});

// Milliseconds between steps at 1x. The path itself has no fixed sample rate (Traccar syncs
// every 60s, the driver app whenever it calls in) -- this is a playback pace, not a faithful
// real-time reproduction. A v1 choice, same as LiveMapComponent's fixed broadcast cadence.
const BASE_STEP_MS = 400;
const SPEEDS = [1, 2, 4, 8] as const;

interface TripReplayModalProps {
  tripId: string;
  tripVehicleId: string;
  label?: string;
  onClose: () => void;
}

export const TripReplayModal: React.FC<TripReplayModalProps> = ({
  tripId,
  tripVehicleId,
  label,
  onClose,
}) => {
  const { data, isLoading, error } = useQuery({
    queryKey: keys.trips.replay(tripId, tripVehicleId),
    queryFn: async () => {
      const resp = await fetch(
        `/api/v1/trips/${tripId}/vehicles/${tripVehicleId}/replay/`,
        { credentials: "include" },
      );
      if (!resp.ok) throw new Error(`replay fetch failed: ${resp.status}`);
      const envelope = (await resp.json()) as { result?: { path?: ReplayPoint[] } };
      return envelope.result?.path ?? [];
    },
  });

  const path = data ?? [];
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset playback whenever a different vehicle's path loads in (same modal instance can be
  // reused across opens if the parent keeps it mounted).
  useEffect(() => {
    setCurrentIndex(0);
    setIsPlaying(false);
  }, [tripVehicleId]);

  useEffect(() => {
    if (!isPlaying || path.length === 0) return;
    timerRef.current = setInterval(() => {
      setCurrentIndex((i) => {
        if (i >= path.length - 1) {
          setIsPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, BASE_STEP_MS / speed);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, speed, path.length]);

  const atEnd = path.length > 0 && currentIndex >= path.length - 1;
  const currentPoint = path[currentIndex];

  return (
    <Modal open title={`Trip Replay${label ? ` — ${label}` : ""}`} onClose={onClose} size="lg">
      <div className="space-y-3">
        {isLoading ? (
          <div className="h-72 skeleton flex items-center justify-center text-text-secondary text-sm">
            Loading path…
          </div>
        ) : error ? (
          <p className="text-sm text-danger">Failed to load the recorded path.</p>
        ) : (
          <>
            <TripReplayMap path={path} currentIndex={currentIndex} />

            {path.length === 0 ? null : (
              <div className="space-y-2">
                <input
                  type="range"
                  min={0}
                  max={Math.max(0, path.length - 1)}
                  value={currentIndex}
                  onChange={(e) => {
                    setIsPlaying(false);
                    setCurrentIndex(Number(e.target.value));
                  }}
                  className="w-full"
                />
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        if (atEnd) setCurrentIndex(0);
                        setIsPlaying((p) => !p || atEnd);
                      }}
                    >
                      {isPlaying ? (
                        <Pause className="w-3.5 h-3.5" />
                      ) : (
                        <Play className="w-3.5 h-3.5" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setIsPlaying(false);
                        setCurrentIndex(0);
                      }}
                      title="Restart"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </Button>
                    {SPEEDS.map((s) => (
                      <button
                        key={s}
                        onClick={() => setSpeed(s)}
                        className={`px-2 py-1 rounded-md text-xs font-medium ${
                          speed === s
                            ? "bg-brand-blue text-white"
                            : "bg-ops-card2 text-text-secondary"
                        }`}
                      >
                        {s}x
                      </button>
                    ))}
                  </div>
                  <span className="text-xs text-text-tertiary tabular-nums">
                    {currentIndex + 1} / {path.length}
                    {currentPoint && ` · ${new Date(currentPoint.at).toLocaleTimeString()}`}
                  </span>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
};

TripReplayModal.displayName = "TripReplayModal";
