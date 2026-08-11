"use client";

import React, { useState, type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createQueryClient } from "./query";
import { AuthProvider } from "../auth/AuthProvider";

interface ApiProvidersProps {
  children: ReactNode;
}

export function ApiProviders({ children }: ApiProvidersProps) {
  const [queryClient] = useState(() => createQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}
