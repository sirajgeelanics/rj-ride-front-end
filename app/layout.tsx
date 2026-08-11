import React from "react";
import type { Metadata } from "next";
import { ApiProviders } from "@/lib/shared/api";
import { AppShell } from "@/components/layout/AppShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "RIDE — Rezolv Integrated Dispatch Engine",
  description: "Multi-tenant B2B Transport Management System",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ApiProviders>
          <AppShell>{children}</AppShell>
        </ApiProviders>
      </body>
    </html>
  );
}
