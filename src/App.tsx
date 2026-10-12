import React, { useEffect } from "react";
import { Route, Routes } from "react-router-dom";
import Overview from "@/pages/index";
import Activity from "@/pages/activity";
import Attention from "@/pages/attention";
import ConfigGaps from "@/pages/config-gaps";
import Fleet from "@/pages/fleet";
import Login from "@/pages/login";
import LiveMap from "@/pages/map";
import Money from "@/pages/money";
import RateCards from "@/pages/rate-cards";
import Tenants from "@/pages/tenants";
import TenantDetail from "@/pages/tenants-Detail";
import Trips from "@/pages/trips";
import Vendors from "@/pages/vendors";
import VendorDetail from "@/pages/vendors-Detail";

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

// Same URLs as the previous Next.js app/ directory.
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Overview />} />
      <Route path="/activity" element={<Activity />} />
      <Route path="/attention" element={<Attention />} />
      <Route path="/config-gaps" element={<ConfigGaps />} />
      <Route path="/fleet" element={<Fleet />} />
      <Route path="/login" element={<Login />} />
      <Route path="/map" element={<LiveMap />} />
      <Route path="/money" element={<Money />} />
      <Route path="/rate-cards" element={<RateCards />} />
      <Route path="/tenants" element={<Tenants />} />
      <Route path="/tenants/:id" element={<TenantDetail />} />
      <Route path="/trips" element={<Trips />} />
      <Route path="/vendors" element={<Vendors />} />
      <Route path="/vendors/:id" element={<VendorDetail />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
