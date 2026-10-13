import React, { useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import ApiConsolePage from "@/pages/api-console";
import AvailabilityPage from "@/pages/availability";
import BillingPage from "@/pages/billing";
import ConfigurationPage from "@/pages/configuration";
import DispatchPage from "@/pages/dispatch";
import KitchenSinkPage from "@/pages/kitchen-sink";
import LoginPage from "@/pages/login";
import IndexPage from "@/pages/index";
import PricingPage from "@/pages/pricing";
import RitmoPage from "@/pages/ritmo";
import TrackingPage from "@/pages/tracking";
import TripsPage from "@/pages/trips";

function NotFound() {
  useEffect(() => {
    const previous = document.title;
    document.title = "404: This page could not be found.";
    return () => {
      document.title = previous;
    };
  }, []);
  return (
    <div className="flex items-center justify-center py-24 text-center">
      <h1 className="mr-5 border-r border-border pr-5 text-2xl font-medium">404</h1>
      <h2 className="text-sm">This page could not be found.</h2>
    </div>
  );
}

/** Same enter animation the Next.js app/template.tsx gave every route (remounts per navigation). */
export function AppRoutes() {
  const { pathname } = useLocation();
  return (
    <div className="animate-page-enter" key={pathname}>
    <Routes>
      <Route path="/api-console" element={<ApiConsolePage />} />
      <Route path="/availability" element={<AvailabilityPage />} />
      <Route path="/billing" element={<BillingPage />} />
      <Route path="/configuration" element={<ConfigurationPage />} />
      <Route path="/dispatch" element={<DispatchPage />} />
      <Route path="/kitchen-sink" element={<KitchenSinkPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<IndexPage />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/ritmo" element={<RitmoPage />} />
      <Route path="/tracking" element={<TrackingPage />} />
      <Route path="/trips" element={<TripsPage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
    </div>
  );
}
