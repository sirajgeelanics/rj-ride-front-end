"use client";

import React, { type ReactNode } from "react";
import { isApiError } from "./client";

interface QueryBoundaryProps {
  isLoading: boolean;
  error: Error | null | unknown;
  isEmpty?: boolean;
  loadingFallback?: ReactNode;
  emptyFallback?: ReactNode;
  children: ReactNode;
}

export function QueryBoundary({
  isLoading,
  error,
  isEmpty,
  loadingFallback,
  emptyFallback,
  children,
}: QueryBoundaryProps): React.ReactElement {
  if (isLoading) {
    return (
      <>{loadingFallback ?? <DefaultLoadingState />}</>
    );
  }

  if (error) {
    if (isApiError(error) && error.status === 403) {
      return <PermissionDeniedState />;
    }
    return <ErrorState error={error} />;
  }

  if (isEmpty) {
    return <>{emptyFallback ?? <DefaultEmptyState />}</>;
  }

  return <>{children}</>;
}

function DefaultLoadingState(): React.ReactElement {
  return (
    <div className="py-6 space-y-2.5" role="status" aria-label="Loading">
      <div className="skeleton h-10 w-full" />
      <div className="skeleton h-12 w-full" />
      <div className="skeleton h-12 w-full" />
      <div className="skeleton h-12 w-4/5" />
    </div>
  );
}

function DefaultEmptyState(): React.ReactElement {
  return (
    <div className="py-12 text-center text-sm text-text-secondary border border-dashed border-border rounded-2xl bg-white">
      No results found.
    </div>
  );
}

function PermissionDeniedState(): React.ReactElement {
  return (
    <div className="py-12 text-center">
      <p className="text-sm font-medium text-danger">Access denied</p>
      <p className="text-xs text-text-secondary mt-1">
        You do not have permission to view this resource.
      </p>
    </div>
  );
}

function ErrorState({ error }: { error: unknown }): React.ReactElement {
  const msg = isApiError(error)
    ? `${error.message}${error.code ? ` (${error.code})` : ""}`
    : error instanceof Error
    ? error.message
    : "An unexpected error occurred.";

  return (
    <div className="py-12 text-center">
      <p className="text-sm font-medium text-danger">Error</p>
      <p className="text-xs text-text-secondary mt-1">{msg}</p>
    </div>
  );
}
