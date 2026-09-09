"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/shared";
import { fetchAllPages } from "@/hooks/useCursorPagination";
import type { components } from "@/lib/shared/api/schema.d";
import { useToastStore } from "@/stores/toastStore";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { ArrowUp, ArrowDown, X, Plus, ListOrdered } from "lucide-react";

// dispatch_priority isn't in the generated schema yet (a new backend addition), and
// airport_code never was (the backend renamed it from "city" without a schema regen — same
// stale-schema workaround used elsewhere in this codebase, e.g. VehicleAssignmentModal.tsx):
// intersect both in rather than risk a full schema regen as a side effect.
type Vendor = components["schemas"]["Vendor"] & {
  airport_code?: string | null;
  dispatch_priority: number | null;
};
type PatchedVendor = components["schemas"]["PatchedVendor"];

/**
 * Configuration -> Priority Matrix: which vendor RITMO auto-dispatch tries FIRST at a given
 * airport. Backs apps.trips.services.vendors_in_city — P1 is offered the request before P2,
 * and so on; a vendor never placed here is still eligible, just tried last (original
 * first-come-first-served order), so nothing silently stops dispatching the moment this ships.
 *
 * One airport at a time, deliberately: editing every airport's whole vendor pool in one giant
 * grid would be a much bigger, riskier UI for the same outcome ("set priority for vendors at a
 * particular location") the request actually asked for.
 */
export const PriorityMatrixTab: React.FC = () => {
  const addToast = useToastStore((s) => s.addToast);
  const qc = useQueryClient();

  const [airportCode, setAirportCode] = useState("");
  // Local working copy of the ranked order for the selected airport — P1 first. Only vendor
  // ids; looked up against `vendors` for display. Edited via the up/down/remove/add buttons
  // below, saved explicitly (not auto-saved per click) so a half-finished reorder never
  // half-applies.
  const [rankedIds, setRankedIds] = useState<string[]>([]);

  // Deliberately a private key (not keys.config.vendors.list()) — that bare key is already
  // cached under other shapes by other screens (VendorsTab paginates+filters by name; the
  // Availability page caches a { results } page-size-100 slice). A private key sidesteps the
  // mismatch instead of risking whichever shape happened to load first.
  const { data: vendors = [], isLoading } = useQuery({
    queryKey: ["priority-matrix", "vendors"],
    queryFn: () => fetchAllPages<Vendor>("/api/v1/config/vendors/"),
  });

  const airportCodes = useMemo(() => {
    const set = new Set<string>();
    for (const v of vendors) {
      if (v.airport_code) set.add(v.airport_code);
    }
    return [...set].sort();
  }, [vendors]);

  const vendorsAtAirport = useMemo(() => {
    if (!airportCode) return [];
    const code = airportCode.toLowerCase();
    return vendors.filter((v) => (v.airport_code ?? "").toLowerCase() === code);
  }, [vendors, airportCode]);

  // The server's own current ranking for this airport — P1 first, then unranked (by
  // created_at, matching vendors_in_city's own FCFS fallback) so the starting list already
  // reads in real dispatch order.
  const serverRankedIds = useMemo(() => {
    const ranked = vendorsAtAirport
      .filter((v) => v.dispatch_priority != null)
      .sort((a, b) => (a.dispatch_priority ?? 0) - (b.dispatch_priority ?? 0));
    return ranked.map((v) => v.id);
  }, [vendorsAtAirport]);

  // Everything NOT currently in the working ranked list — including a vendor just removed from
  // it (still ranked on the server, but locally taken out), not only vendors that were always
  // unranked. Otherwise a removed vendor would vanish from both lists until the page reloads.
  const unrankedVendors = useMemo(() => {
    return vendorsAtAirport
      .filter((v) => !rankedIds.includes(v.id))
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [vendorsAtAirport, rankedIds]);

  // Re-sync the working copy whenever the selected airport (or the underlying data) changes —
  // never mid-edit, so switching airports can't clobber an in-progress reorder of a DIFFERENT
  // airport that was never saved.
  useEffect(() => {
    setRankedIds(serverRankedIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [airportCode, vendorsAtAirport.length]);

  const vendorById = useMemo(() => {
    const m = new Map<string, Vendor>();
    for (const v of vendors) m.set(v.id, v);
    return m;
  }, [vendors]);

  const move = (index: number, dir: -1 | 1) => {
    setRankedIds((prev) => {
      const next = [...prev];
      const swapWith = index + dir;
      if (swapWith < 0 || swapWith >= next.length) return prev;
      [next[index], next[swapWith]] = [next[swapWith]!, next[index]!];
      return next;
    });
  };

  const removeFromRanking = (vendorId: string) => {
    setRankedIds((prev) => prev.filter((id) => id !== vendorId));
  };

  const addToRanking = (vendorId: string) => {
    setRankedIds((prev) => (prev.includes(vendorId) ? prev : [...prev, vendorId]));
  };

  // Only vendors whose priority actually changes make a request — reordering two rows near the
  // bottom of a 20-vendor list shouldn't PATCH all 20.
  const dirtyChanges = useMemo(() => {
    const changes: { id: string; dispatch_priority: number | null }[] = [];
    rankedIds.forEach((id, i) => {
      const newPriority = i + 1;
      if (vendorById.get(id)?.dispatch_priority !== newPriority) {
        changes.push({ id, dispatch_priority: newPriority });
      }
    });
    for (const v of vendorsAtAirport) {
      if (!rankedIds.includes(v.id) && v.dispatch_priority != null) {
        changes.push({ id: v.id, dispatch_priority: null });
      }
    }
    return changes;
  }, [rankedIds, vendorById, vendorsAtAirport]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      await Promise.all(
        dirtyChanges.map(({ id, dispatch_priority }) =>
          apiClient.PATCH("/v1/config/vendors/{id}", {
            params: { path: { id } },
            body: { dispatch_priority } as unknown as PatchedVendor,
          })
        )
      );
    },
    onSuccess: () => {
      addToast("Priority order saved.", "success");
      void qc.invalidateQueries({ queryKey: ["priority-matrix", "vendors"] });
    },
    onError: (err: unknown) => {
      addToast(err instanceof Error ? err.message : "Failed to save priority order", "error");
    },
  });

  return (
    <div className="space-y-4">
      <Card padding="md" className="bg-ops-bg">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-64">
            <label className="block text-xs text-text-secondary mb-1">Airport</label>
            <SearchableSelect
              value={airportCode}
              onChange={setAirportCode}
              options={airportCodes.map((c) => ({ value: c, label: c }))}
              placeholder={isLoading ? "Loading…" : "Search airport…"}
            />
          </div>
          {airportCode && dirtyChanges.length > 0 && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? "Saving…" : `Save changes (${dirtyChanges.length})`}
            </Button>
          )}
        </div>
      </Card>

      {!airportCode ? (
        <Card padding="lg" className="text-center text-text-secondary py-10">
          <ListOrdered className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p>Pick an airport to set which vendor RITMO tries first there.</p>
        </Card>
      ) : vendorsAtAirport.length === 0 ? (
        <Card padding="lg" className="text-center text-text-secondary py-10">
          <p>No vendors operate at {airportCode}.</p>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card padding="md" header={<h3 className="text-sm font-semibold">Priority order at {airportCode}</h3>}>
            {rankedIds.length === 0 ? (
              <p className="text-xs text-text-tertiary py-4 text-center">
                No vendor is ranked yet — every request here goes by onboarding order until you
                add one below.
              </p>
            ) : (
              <div className="space-y-1.5">
                {rankedIds.map((id, i) => {
                  const v = vendorById.get(id);
                  if (!v) return null;
                  return (
                    <div
                      key={id}
                      className="flex items-center gap-2 p-2 rounded-lg border border-border bg-white"
                    >
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-brand-blue/10 text-brand-blue text-xs font-semibold shrink-0">
                        P{i + 1}
                      </span>
                      <span className="text-sm text-text-primary flex-1 truncate">{v.name}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={i === 0}
                          onClick={() => move(i, -1)}
                          title="Move up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={i === rankedIds.length - 1}
                          onClick={() => move(i, 1)}
                          title="Move down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-danger hover:bg-danger/10"
                          onClick={() => removeFromRanking(id)}
                          title="Remove from priority order"
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card padding="md" header={<h3 className="text-sm font-semibold">Unranked vendors</h3>}>
            {unrankedVendors.length === 0 ? (
              <p className="text-xs text-text-tertiary py-4 text-center">
                Every vendor at {airportCode} is ranked.
              </p>
            ) : (
              <div className="space-y-1.5">
                {unrankedVendors.map((v) => (
                  <div
                    key={v.id}
                    className="flex items-center gap-2 p-2 rounded-lg border border-border bg-white"
                  >
                    <span className="text-sm text-text-primary flex-1 truncate">{v.name}</span>
                    <Button size="sm" variant="secondary" onClick={() => addToRanking(v.id)}>
                      <Plus className="w-3.5 h-3.5" /> Add to priority order
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
};

PriorityMatrixTab.displayName = "PriorityMatrixTab";
