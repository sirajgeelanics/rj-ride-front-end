"use client";

import React, { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Geist, Geist_Mono } from "next/font/google";
import { ApiProviders, useRideEvents, keys } from "@/lib/shared";
import { useSession, useAuth } from "@/lib/shared";
import { useQueryClient } from "@tanstack/react-query";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { OfflineBanner } from "@/components/ui/OfflineBanner";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const PAGE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/offers": "Offers",
  "/trips": "Trips",
  "/fleet": "Fleet",
  "/earnings": "Earnings",
  "/alerts": "Alerts",
};

// Must match the backend's User.Role enum (apps/accounts): the vendor-side roles are
// VENDOR_MANAGER and DRIVER. The old values ("VENDOR_ADMIN"/"VENDOR_AGENT") don't exist,
// so every real vendor user was wrongly rejected with "Access Denied".
const VENDOR_ROLES = ["VENDOR_MANAGER", "DRIVER"] as const;

/** Query key for the vendor's live offer queue — shared with the Offers page and the sidebar badge. */
export const VENDOR_OFFERS_KEY = ["vendor", "offers"] as const;

function RealtimeSync() {
  const qc = useQueryClient();
  const { addToast } = useToast();

  useRideEvents({
    invalidationMap: {
      "trip.created": keys.trips.all(),
      "trip.updated": keys.trips.all(),
      "trip.cancelled": keys.trips.all(),
      "trip.completed": keys.trips.all(),
      "trip.assigned": keys.trips.all(),
      // The vendor-offer lifecycle. The server already forwards these WS-side and filters them
      // by payload.vendor_id, but the portal was not listening — so a new or alerted offer only
      // surfaced via the Offers page's 15s poll, and not at all from any other page.
      "trip.offer_made": VENDOR_OFFERS_KEY,
      "trip.offer_alerted": VENDOR_OFFERS_KEY,
      "trip.offer_expired": VENDOR_OFFERS_KEY,
      "trip.offer_withdrawn": VENDOR_OFFERS_KEY,
      "billing.invoice_created": keys.billing.all(),
      "billing.invoice_updated": keys.billing.all(),
    },
    handler: (event) => {
      if (event.type === "document.expiry_warning") {
        void qc.invalidateQueries({ queryKey: keys.fleet.all() });
        return;
      }
      // The alert is also recorded as an in-app notification (notifications/routing.py), so pull
      // the Alerts feed forward too rather than leaving it to its 30s poll.
      if (event.type.startsWith("trip.offer_")) {
        void qc.invalidateQueries({ queryKey: ["notifications", "mine"] });
      }

      // Offers expire on a timer, so a silent cache refresh is not enough — say it out loud.
      const ref = (event as { payload?: { reference?: string } }).payload?.reference;
      if (event.type === "trip.offer_made") {
        addToast(`New trip offer${ref ? ` ${ref}` : ""} — accept before it expires.`, "info");
      } else if (event.type === "trip.offer_alerted") {
        addToast(`Reminder: offer${ref ? ` ${ref}` : ""} is still awaiting your response.`, "error");
      } else if (event.type === "trip.offer_expired") {
        addToast(`Offer${ref ? ` ${ref}` : ""} expired and went back to the agency.`, "info");
      }
    },
  });
  return null;
}

function LayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading } = useSession();
  const { logout } = useAuth();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const { addToast } = useToast();

  const handleShortcutNavigate = useCallback(() => {
    const hintDismissed = sessionStorage.getItem("ride_kb_hint_dismissed");
    if (!hintDismissed) {
      sessionStorage.setItem("ride_kb_hint_dismissed", "true");
      addToast("Keyboard shortcuts active: 1-6 to navigate", "info");
    }
    setMobileSidebarOpen(false);
  }, [addToast]);

  useKeyboardShortcuts({ onNavigate: handleShortcutNavigate });

  const isLogin = pathname === "/login";
  const title = PAGE_TITLES[pathname] || "Vendor Portal";

  // Redirect from an effect, never from the render body. Calling router.push() while this
  // component renders updates the Router mid-render, which React reports as
  // "Cannot update a component (Router) while rendering a different component (LayoutInner)".
  // `replace` (not `push`) so the protected URL isn't left in history for the back button.
  useEffect(() => {
    if (!isLoading && !user && !isLogin) {
      router.replace("/login");
    }
  }, [isLoading, user, isLogin, router]);

  if (isLogin) return <>{children}</>;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-page-bg flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-brand-blue border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-text-muted">Loading...</p>
        </div>
      </div>
    );
  }

  // The effect above is navigating; render nothing rather than flashing the shell.
  if (!user) return null;

  const isVendor = VENDOR_ROLES.includes(user.role as typeof VENDOR_ROLES[number]);
  if (!isVendor) {
    // Almost always a session bleed rather than a real permission problem: cookies are not
    // scoped by port (RFC 6265), so signing into the agency portal on :3000 puts an
    // AGENCY_ADMIN session on the same host that this portal reads on :3001. Without a way
    // out this screen is a dead end — the login form is unreachable because the effect above
    // treats you as already signed in.
    return (
      <div className="min-h-screen bg-page-bg flex items-center justify-center p-6">
        <div className="text-center space-y-3 max-w-sm">
          <p className="text-lg font-semibold text-text-primary">Signed in as the wrong account</p>
          <p className="text-sm text-text-muted">
            This portal is for vendor accounts. You are signed in as{" "}
            <span className="font-medium text-text-primary">{user.email}</span> ({user.role}).
          </p>
          <p className="text-xs text-text-muted">
            Browsers share cookies across ports, so an agency session on another port signs you
            in here too.
          </p>
          <button
            onClick={() => {
              void logout().then(() => router.replace("/login"));
            }}
            className="mt-2 px-4 py-2 rounded-lg bg-brand-blue text-white text-sm font-medium hover:opacity-90"
          >
            Sign out and use a vendor account
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <RealtimeSync />
      <Sidebar mobileOpen={mobileSidebarOpen} onMobileClose={() => setMobileSidebarOpen(false)} />
      <div className="flex-1 lg:ml-60 flex flex-col min-w-0">
        <Header title={title} onToggleMobile={() => setMobileSidebarOpen((p) => !p)} />
        <OfflineBanner />
        <main className="flex-1 p-4 lg:p-6 overflow-x-hidden">
          <ErrorBoundary>{children}</ErrorBoundary>
        </main>
      </div>
    </div>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-screen bg-page-bg">
        <ApiProviders>
          <ErrorBoundary>
            <ToastProvider>
              <LayoutInner>{children}</LayoutInner>
            </ToastProvider>
          </ErrorBoundary>
        </ApiProviders>
      </body>
    </html>
  );
}
