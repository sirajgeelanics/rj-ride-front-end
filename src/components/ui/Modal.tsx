import React, { useEffect } from "react";
import { X } from "lucide-react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  /** A richer gold-accented border/shadow/header treatment for a dialog that should feel like
   * a standout moment (e.g. a pricing/commercial-terms form), instead of this component's
   * plain default — opt-in so every existing confirm dialog and form keeps its current look. */
  premium?: boolean;
}

const sizeMap = {
  sm: "w-[calc(100vw-2rem)] sm:w-96",
  md: "w-[calc(100vw-2rem)] sm:w-[28rem]",
  lg: "w-[calc(100vw-2rem)] sm:w-[36rem]",
  // For a form with more fields than lg comfortably fits (e.g. a multi-section create/edit
  // dialog) — still centered and capped well under the viewport, never full-bleed.
  xl: "w-[calc(100vw-2rem)] sm:w-[44rem]",
};

export const Modal: React.FC<ModalProps> = ({ open, onClose, title, children, size = "md", premium = false }) => {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [open, onClose]);

  // Deliberately never unmounts (no `if (!open) return null`) — for the call sites that already
  // pass a stable `open` prop to an always-rendered <Modal> (ConfirmDialog, the common case),
  // unmounting the instant `open` goes false would leave nothing for a CSS transition to
  // animate; it would just vanish. Opacity + scale classes driven by `open` make both the open
  // AND close transitions actually play. (Call sites that additionally wrap <Modal> itself in
  // `{state && <Modal open .../>}` still snap shut on close — that outer conditional unmounts
  // the whole thing regardless of what happens in here; only fixable at each of those call
  // sites individually.)
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-hidden={!open}
      aria-label={title}
      // Frosted backdrop, matching Drawer. `bg-[#072D62] bg-opacity-50` read as a flat blackout and
      // is Tailwind v3 syntax besides; the slash-opacity + backdrop-blur keeps the page legible
      // behind the dialog. z-[60] is explicit so it doesn't rely on a non-default `z-60` class.
      className={`fixed inset-0 bg-[#04204A]/45 backdrop-blur-sm flex items-center justify-center z-[60] transition-opacity duration-200 ${
        open ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
      onClick={onClose}
    >
      <div
        className={`${sizeMap[size]} bg-white rounded-2xl flex flex-col max-h-[90vh] overflow-hidden transition-[transform,opacity] duration-300 ease-[var(--ease-spring)] ${
          premium
            ? "border-[1.5px] border-accent-gold/35 shadow-[0_32px_80px_-8px_rgba(4,32,74,0.38),0_0_0_1px_rgba(179,150,97,0.18),0_2px_10px_rgba(179,150,97,0.14)]"
            : "border border-border shadow-modal"
        } ${open ? "scale-100 opacity-100 translate-y-0" : "scale-95 opacity-0 translate-y-2"}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* A thin gold strip rather than a bold banner — reads as "commercial terms, handle with
            care" without competing with the serif title for attention. */}
        {premium && <div className="h-[3px] shrink-0 bg-gradient-to-r from-accent-gold/70 via-accent-gold to-accent-gold/70" />}
        <div
          className={`flex items-center justify-between gap-3 px-6 py-4 ${
            premium ? "border-b border-accent-gold/20 bg-gradient-to-b from-[#FBF8F1] to-white" : "border-b border-ops-line bg-white"
          }`}
        >
          <h2 className="font-serif text-2xl font-medium tracking-tight text-text-primary">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 -mr-1.5 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-ops-card2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/30"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 text-text-primary">
          {children}
        </div>
      </div>
    </div>
  );
};

Modal.displayName = "Modal";
