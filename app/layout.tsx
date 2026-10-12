import React from "react";
import type { Metadata } from "next";
import { Providers } from "@/lib/providers";
import { AppShell } from "@/components/layout/AppShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "RIDE — Super admin portal",
  description: "Read-only, cross-tenant view of tenants, vendors and trips",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
