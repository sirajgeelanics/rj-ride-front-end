"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, FileSpreadsheet, Truck, Upload, Users } from "lucide-react";
import { ImportDialog } from "@/components/ui/ImportDialog";
import { useQuery } from "@tanstack/react-query";
import { keys } from "@/lib/shared";
import { fetchAllPages } from "@/hooks/useCursorPagination";
import type { components } from "@/lib/shared/api/schema.d";

type ApiVendor = components["schemas"]["Vendor"];

type Mode = "both" | "vehicles" | "drivers";

const OPTIONS: {
  mode: Mode;
  title: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    mode: "both",
    title: "Vehicles & drivers",
    hint: "One Excel file with both. Recommended.",
    icon: FileSpreadsheet,
  },
  { mode: "vehicles", title: "Vehicles only", hint: "Plate, type, model, airport", icon: Truck },
  { mode: "drivers", title: "Drivers only", hint: "Name, phone, licence, optional login", icon: Users },
];

const HINTS: Record<Mode, React.ReactNode> = {
  both: (
    <>
      One Excel workbook (or CSV) can hold both: a <b>Vehicles</b> sheet (<b>plate</b>,{" "}
      <b>vehicle_type</b>, <b>vendor</b>; optional <b>vehicle_name</b>, <b>traccar_device_id</b>,{" "}
      <b>airport_code</b>) and a <b>Drivers</b> sheet (<b>name</b>, <b>phone</b>,{" "}
      <b>licence_number</b>, <b>vendor</b>; optional <b>email</b> + <b>password</b> for the app login,{" "}
      <b>airport_code</b>). Sheets are recognised by their headings, so names and order don&apos;t
      matter. Either sheet can be left out. Vehicles are imported first, then drivers.
    </>
  ),
  vehicles: (
    <>
      Required columns: <b>plate</b>, <b>vehicle_type</b>, and <b>vendor</b> (unless you pick one in the dialog). Optional:{" "}
      <b>vehicle_name</b>, <b>traccar_device_id</b>, <b>airport_code</b> (needed only for a vendor
      with several airports). Type and model are matched by name and must already exist.
    </>
  ),
  drivers: (
    <>
      Required columns: <b>name</b>, <b>phone</b>, <b>licence_number</b>, and <b>vendor</b> (unless you pick one in the dialog). Optional:{" "}
      <b>email</b> and <b>password</b> (at least 12 characters) to also create the driver&apos;s app
      login — leave both blank to skip it. <b>airport_code</b> is needed only for a vendor with
      several airports.
    </>
  ),
};

const DIALOGS: Record<Mode, { title: string; endpoint: string; file: string; noun: string }> = {
  both: {
    title: "Import vehicles & drivers",
    endpoint: "/api/v1/fleet",
    file: "fleet-import-template.xlsx",
    noun: "row",
  },
  vehicles: {
    title: "Import vehicles",
    endpoint: "/api/v1/fleet/vehicles",
    file: "vehicles-import-template.csv",
    noun: "vehicle",
  },
  drivers: {
    title: "Import drivers",
    endpoint: "/api/v1/fleet/drivers",
    file: "drivers-import-template.csv",
    noun: "driver",
  },
};

/** Navbar "Import" button: one place to bring in vehicles, drivers, or both from a single file. */
export function FleetImportMenu() {
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mode, setMode] = useState<Mode | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  // The top bar uses backdrop-filter, which turns it into the containing block for `fixed`
  // descendants — a dialog rendered inside it is sized to the bar and pushed off-screen. The
  // dialogs are portalled to <body> (after mount, so server and client markup agree).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const { data: vendorsData } = useQuery({
    queryKey: keys.config.vendors.list(),
    queryFn: async () => ({ results: await fetchAllPages<ApiVendor>("/api/v1/config/vendors/") }),
  });
  const vendorOptions = (vendorsData?.results ?? []).map((v) => ({ value: v.id, label: v.name }));

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const refresh = (which: Mode) => {
    if (which !== "drivers") void queryClient.invalidateQueries({ queryKey: ["fleet", "vehicles"] });
    if (which !== "vehicles") void queryClient.invalidateQueries({ queryKey: ["fleet", "drivers"] });
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setMenuOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        className="inline-flex items-center gap-2 px-3 sm:px-4 h-9 rounded-lg text-sm font-semibold text-white shadow-soft shadow-[inset_0_1px_0_rgba(255,255,255,0.16)] hover:shadow-lift hover:brightness-110 hover:-translate-y-px transition-all bg-gradient-to-b from-[#0E3F82] to-brand-wine focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/40 focus-visible:ring-offset-2 focus-visible:ring-offset-ops-bg"
      >
        <Upload className="w-4 h-4" />
        <span className="hidden sm:inline">Import</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${menuOpen ? "rotate-180" : ""}`} />
      </button>

      {menuOpen && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-72 max-w-[calc(100vw-1.5rem)] rounded-xl border border-border bg-white shadow-lift z-40 p-1.5 animate-menu-in"
        >
          {OPTIONS.map(({ mode: m, title, hint, icon: Icon }) => (
            <button
              key={m}
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                setMode(m);
              }}
              className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-ops-bg transition-colors focus-visible:outline-none focus-visible:bg-ops-bg focus-visible:ring-2 focus-visible:ring-brand-blue/30"
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                  m === "both" ? "bg-gradient-to-br from-[#0E3F82] to-brand-wine text-white shadow-soft" : "bg-navy-soft text-brand-wine"
                }`}
              >
                <Icon className="w-4.5 h-4.5" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-text-primary">{title}</span>
                <span className="block text-xs text-text-secondary truncate">{hint}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {mounted &&
        createPortal(
          <>
            {(Object.keys(DIALOGS) as Mode[]).map((m) => (
              <ImportDialog
                key={m}
                open={mode === m}
                onClose={() => setMode(null)}
                title={DIALOGS[m].title}
                endpoint={DIALOGS[m].endpoint}
                templateFilename={DIALOGS[m].file}
                noun={DIALOGS[m].noun}
                vendors={vendorOptions}
                columnsHint={HINTS[m]}
                onImported={() => refresh(m)}
              />
            ))}
          </>,
          document.body,
        )}
    </div>
  );
}
