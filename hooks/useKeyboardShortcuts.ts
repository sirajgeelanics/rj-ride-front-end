"use client";

import { useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

const SHORTCUT_MAP: Record<string, string> = {
  "1": "/",
  "2": "/trips",
  "3": "/fleet",
  "4": "/earnings",
  "5": "/alerts",
};

interface UseKeyboardShortcutsOptions {
  onNavigate?: (path: string) => void;
}

export function useKeyboardShortcuts({ onNavigate }: UseKeyboardShortcutsOptions = {}) {
  const router = useRouter();
  const bufferRef = useRef("");

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't capture when user is typing in an input
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const key = e.key;

      // G-buffer: wait for second key after 'g' (timeout after 1s)
      if (key === "g") {
        bufferRef.current = "g";
        setTimeout(() => {
          if (bufferRef.current === "g") bufferRef.current = "";
        }, 1000);
        return;
      }

      if (bufferRef.current === "g") {
        bufferRef.current = "";
        if (key === "d") {
          e.preventDefault();
          onNavigate?.("/");
          router.push("/");
          return;
        }
        if (key === "t") {
          e.preventDefault();
          onNavigate?.("/trips");
          router.push("/trips");
          return;
        }
        if (key === "f") {
          e.preventDefault();
          onNavigate?.("/fleet");
          router.push("/fleet");
          return;
        }
        if (key === "e") {
          e.preventDefault();
          onNavigate?.("/earnings");
          router.push("/earnings");
          return;
        }
        if (key === "a") {
          e.preventDefault();
          onNavigate?.("/alerts");
          router.push("/alerts");
          return;
        }
        bufferRef.current = "";
        return;
      }

      // Number shortcuts
      const path = SHORTCUT_MAP[key];
      if (path) {
        e.preventDefault();
        onNavigate?.(path);
        router.push(path);
      }
    },
    [router, onNavigate]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
