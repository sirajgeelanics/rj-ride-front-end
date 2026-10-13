import "@/lib/envShim";
import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { VendorLayout } from "@/layout/VendorLayout";
import { AppRoutes } from "@/App";
import "./globals.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter basename="/vendor">
      <VendorLayout>
        <AppRoutes />
      </VendorLayout>
    </BrowserRouter>
  </React.StrictMode>,
);
