import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Providers } from "@/lib/providers";
import { AppShell } from "@/components/layout/AppShell";
import { AppRoutes } from "@/App";
import "./globals.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Providers>
        <AppShell>
          <AppRoutes />
        </AppShell>
      </Providers>
    </BrowserRouter>
  </React.StrictMode>,
);
