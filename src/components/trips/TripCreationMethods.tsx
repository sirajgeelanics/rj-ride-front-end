import React, { useEffect } from "react";
import { ArrowRight, CalendarClock, ClipboardPen, Copy, FileSpreadsheet, Inbox, Sparkles, X } from "lucide-react";
import { useLanguageStore, t } from "@/lib/shared";

export type CreationMethod = "MANUAL" | "BULK_UPLOAD" | "RECURRING" | "CLONE";

interface MethodDef {
  id: CreationMethod;
  icon: React.ComponentType<{ className?: string }>;
  titleKey: "manualEntry" | "bulkUploadCSV" | "recurringGenerator" | "cloneExistingTrip";
  description: string;
  chip: string;
  featured?: boolean;
}

export const METHODS: MethodDef[] = [
  {
    id: "MANUAL",
    icon: ClipboardPen,
    titleKey: "manualEntry",
    description: "Enter the customer, route, vehicles and passengers yourself, and see the locked price before you book.",
    chip: "Single trip",
    featured: true,
  },
  {
    id: "BULK_UPLOAD",
    icon: FileSpreadsheet,
    titleKey: "bulkUploadCSV",
    description: "Upload a CSV to create many trips at once. Every row is validated before anything is booked.",
    chip: "Many trips",
  },
  {
    id: "RECURRING",
    icon: CalendarClock,
    titleKey: "recurringGenerator",
    description: "Set a schedule for daily or weekly trips, such as staff shuttles or regular transfers.",
    chip: "On a schedule",
  },
  {
    id: "CLONE",
    icon: Copy,
    titleKey: "cloneExistingTrip",
    description: "Start from a trip you already have and change only what is different.",
    chip: "From a past trip",
  },
];

export function getMethod(id: CreationMethod): MethodDef {
  return METHODS.find((m) => m.id === id)!;
}

/** Step 1 of creating a trip: pick how. Keys 1-4 choose a card. */
export function MethodPicker({ onSelect }: { onSelect: (m: CreationMethod) => void }) {
  const language = useLanguageStore((s) => s.language);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const m = METHODS[Number(e.key) - 1];
      if (m) onSelect(m.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSelect]);

  return (
    <div className="space-y-5">
      <div>
        <p className="eyebrow">Step 1 of 2</p>
        <h3 className="font-serif text-2xl font-medium text-text-primary mt-1">
          {t("chooseCreationMethod", language)}
        </h3>
        <p className="text-sm text-text-secondary mt-1">
          Pick the way that fits. You can go back and switch at any time before booking.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-3 stagger">
        {METHODS.map((m, i) => {
          const Icon = m.icon;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onSelect(m.id)}
              className={`group relative text-left rounded-2xl border p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/40 ${
                m.featured
                  ? "border-brand-blue/40 bg-navy-soft/60 hover:border-brand-blue"
                  : "border-border bg-white hover:border-brand-blue/50"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <span
                  className={`flex h-11 w-11 items-center justify-center rounded-xl ${
                    m.featured ? "bg-brand-blue text-white" : "bg-ops-card2 text-brand-blue"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </span>
                <span className="text-[11px] font-mono text-text-tertiary border border-ops-line rounded-md px-1.5 py-0.5">
                  {i + 1}
                </span>
              </div>
              <h4 className="mt-4 text-base font-semibold text-text-primary flex items-center gap-2">
                {t(m.titleKey, language)}
                {m.featured && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-accent-gold bg-gold-soft rounded-full px-2 py-0.5">
                    <Sparkles className="w-3 h-3" /> Most used
                  </span>
                )}
              </h4>
              <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">{m.description}</p>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs font-medium text-text-secondary bg-ops-card2 rounded-full px-2.5 py-1">
                  {m.chip}
                </span>
                <ArrowRight className="w-4 h-4 text-text-tertiary group-hover:text-brand-blue group-hover:translate-x-0.5 transition-all" />
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-ops-line bg-ops-card2/60 px-4 py-3">
        <Inbox className="w-4 h-4 mt-0.5 text-text-tertiary shrink-0" />
        <p className="text-xs leading-relaxed text-text-secondary">
          Bookings sent in by RITMO or partner systems arrive on their own under
          <span className="font-medium text-text-primary"> Automated Trips</span>. You don&apos;t need to create those here.
        </p>
      </div>
    </div>
  );
}

/**
 * Step 2: the chosen method's form, centred on screen on a clean canvas.
 * Closes on Esc, the X, or a click on the backdrop; "Change method" returns to the picker.
 */
export function TripCreationDialog({
  method,
  onBack,
  onClose,
  children,
}: {
  method: CreationMethod;
  onBack: () => void;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const language = useLanguageStore((s) => s.language);
  const m = getMethod(method);
  const Icon = m.icon;
  const title = t(m.titleKey, language);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${t("createTripRequest", language)}: ${title}`}
      className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-6 bg-[#04204A]/45 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[92vh] flex flex-col rounded-2xl border border-border bg-white shadow-modal overflow-hidden animate-rise-in"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center gap-4 px-5 sm:px-6 py-4 border-b border-ops-line bg-white">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-blue text-white shrink-0">
            <Icon className="w-5 h-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="eyebrow">{t("createTripRequest", language)} · Step 2 of 2</p>
            <h2 className="font-serif text-2xl font-medium tracking-tight text-text-primary truncate">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="hidden sm:inline-flex text-xs font-medium text-brand-blue hover:text-brand-wine-hover rounded-lg px-3 py-2 hover:bg-ops-card2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/30"
          >
            {t("changeMethod", language)}
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-2 -mr-2 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-ops-card2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/30"
          >
            <X className="w-5 h-5" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto bg-ops-bg px-4 sm:px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
