import "@/lib/envShim";
import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ApiProviders } from "@/lib/shared/api";
import { AppShell } from "@/components/layout/AppShell";
import { AppRoutes } from "@/App";
import "./globals.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ApiProviders>
        <AppShell>
          <AppRoutes />
        </AppShell>
      </ApiProviders>
    </BrowserRouter>
  </React.StrictMode>,
);
