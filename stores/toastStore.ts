"use client";

import { useSyncExternalStore } from "react";

/**
 * Transient toast state, on React's own `useSyncExternalStore` — no state library.
 *
 * Toasts are ephemeral UI, not server data, so there is nothing here for Django to own; the
 * point of this rewrite is only that it no longer depends on Zustand. The selector-shaped hook
 * is kept deliberately so the ~26 existing `useToastStore((s) => s.addToast)` call sites did
 * not have to change along with it.
 */

export type ToastType = "success" | "error" | "info";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastStore {
  toasts: Toast[];
  addToast: (message: string, type?: ToastType) => void;
  removeToast: (id: string) => void;
}

const listeners = new Set<() => void>();
let nextId = 0;

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function addToast(message: string, type: ToastType = "info"): void {
  // A counter, not Date.now(): two toasts raised in the same millisecond would share an id and
  // the first timeout would dismiss both.
  const id = `t${nextId++}`;
  setState({ ...state, toasts: [...state.toasts, { id, message, type }] });
  setTimeout(() => removeToast(id), 4000);
}

function removeToast(id: string): void {
  const toasts = state.toasts.filter((t) => t.id !== id);
  if (toasts.length !== state.toasts.length) setState({ ...state, toasts });
}

// The snapshot object is replaced only when something actually changes, so an identity
// selector returns a stable reference and useSyncExternalStore does not loop.
let state: ToastStore = { toasts: [], addToast, removeToast };

function setState(next: ToastStore): void {
  state = next;
  emit();
}

function getSnapshot(): ToastStore {
  return state;
}

export function useToastStore<T = ToastStore>(selector?: (s: ToastStore) => T): T {
  const select = selector ?? ((s: ToastStore) => s as unknown as T);
  return useSyncExternalStore(
    subscribe,
    () => select(getSnapshot()),
    () => select(getSnapshot()),
  );
}
