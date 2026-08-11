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
    <div className="flex items-center justify-center py-12 text-sm text-text-secondary">
      <div className="flex items-center gap-2">
        <span className="animate-spin inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
        Loading…
      </div>
    </div>
  );
}

function DefaultEmptyState(): React.ReactElement {
  return (
    <div className="py-12 text-center text-sm text-text-secondary">
      No results found.
    </div>
  );
}

function PermissionDeniedState(): React.ReactElement {
  return (
    <div className="py-12 text-center">
      <p className="text-sm font-medium text-red-500">Access denied</p>
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
      <p className="text-sm font-medium text-red-500">Error</p>
      <p className="text-xs text-text-secondary mt-1">{msg}</p>
    </div>
  );
}
