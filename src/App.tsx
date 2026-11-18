import React, { useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import AlertsPage from "@/pages/alerts";
import EarningsPage from "@/pages/earnings";
import FleetPage from "@/pages/fleet";
import LoginPage from "@/pages/login";
import OffersPage from "@/pages/offers";
import IndexPage from "@/pages/index";
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
      <Route path="/alerts" element={<AlertsPage />} />
      <Route path="/earnings" element={<EarningsPage />} />
      <Route path="/fleet" element={<FleetPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/offers" element={<OffersPage />} />
      <Route path="/" element={<IndexPage />} />
      <Route path="/trips" element={<TripsPage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
    </div>
  );
}
