"use client";

import React from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Copy } from "lucide-react";
import { useToastStore } from "@/stores/toastStore";

export const ApiDocumentation: React.FC = () => {
  const addToast = useToastStore((s) => s.addToast);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    addToast("Copied to clipboard", "success");
  };

  return (
    <div className="space-y-4">
      {/* Authentication */}
      <Card padding="lg" header={<h3 className="font-semibold text-text-primary">🔐 Authentication</h3>}>
        <div className="space-y-4 text-sm">
          <div>
            <p className="text-text-secondary mb-2">All API requests require Bearer token authentication with your API key:</p>
            <div className="bg-ops-sidebar rounded p-3 font-mono text-xs text-white flex items-center justify-between border border-brand-blue/30">
              <span>Authorization: Bearer sk_live_RISMA_123abc</span>
              <button
                onClick={() => copyToClipboard("Authorization: Bearer sk_live_RISMA_123abc")}
                className="text-white/60 hover:text-white transition-colors"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="bg-brand-blue/10 border border-brand-blue/30 rounded p-3">
            <p className="text-brand-blue text-xs">
              <strong>Note:</strong> API keys are provided when you register a webhook endpoint. Keep them secret!
            </p>
          </div>
        </div>
      </Card>

      {/* Error Responses */}
      <Card padding="lg" header={<h3 className="font-semibold text-text-primary">⚠️ Error Handling</h3>}>
        <div className="space-y-3 text-sm">
          <p className="text-text-secondary">All errors follow a consistent envelope structure:</p>

          <div className="bg-ops-sidebar rounded p-3 font-mono text-xs text-white overflow-x-auto border border-danger/30">
            {`{
  "error": {
    "name": "CUSTOMER_NOT_FOUND",
    "message": "Customer C1 not found",
    "code": "E_CUSTOMER_NOT_FOUND",
    "status": 404
  }
}`}
          </div>

          <div className="space-y-2">
            <p className="text-text-secondary font-medium">HTTP Status Codes:</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <Badge variant="red">400</Badge> Bad Request
              </div>
              <div>
                <Badge variant="red">401</Badge> Unauthorized
              </div>
              <div>
                <Badge variant="red">404</Badge> Not Found
              </div>
              <div>
                <Badge variant="red">429</Badge> Rate Limited
              </div>
              <div>
                <Badge variant="red">500</Badge> Server Error
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Endpoints */}
      <Card padding="lg" header={<h3 className="font-semibold text-text-primary">📡 Endpoints</h3>}>
        <div className="space-y-6">
          {/* POST /partners/v1/trips/from-pax */}
          <div className="border-l-4 border-brand-blue pl-4 space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="blue">POST</Badge>
              <code className="text-sm font-mono text-text-primary">/partners/v1/trips/from-pax</code>
            </div>
            <p className="text-sm text-text-secondary">Create a trip from a list of passengers. Called by RISMA (Revenue Management System).</p>

            <div className="bg-ops-sidebar rounded p-3 text-xs border border-ops-sidebar/80">
              <p className="text-white/80 mb-2">Request:</p>
              <pre className="text-white overflow-x-auto">{`{
  "customerId": "C1",
  "vehicleType": "Sedan",
  "scheduleDate": "2025-06-10",
  "pickupAddress": "KIA, BLR",
  "pickupLat": 13.1979,
  "pickupLng": 77.7064,
  "dropAddress": "MG Road, BLR",
  "dropLat": 13.0331,
  "dropLng": 77.6456,
  "pax": [
    {
      "id": "P1",
      "name": "John Doe",
      "phone": "9876543210",
      "pnr": "AA1234"
    }
  ],
  "reference": "RISMA-JUN-001"
}`}</pre>
            </div>

            <div className="bg-success/10 border border-success/30 rounded p-3 text-xs">
              <p className="text-success mb-2">Response (Success):</p>
              <pre className="text-text-primary overflow-x-auto">{`{
  "result": {
    "tripId": "TR-1234"
  }
}`}</pre>
            </div>
          </div>

          {/* POST /partners/v1/trips/from-vehicle-count */}
          <div className="border-l-4 border-brand-blue pl-4 space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="purple">POST</Badge>
              <code className="text-sm font-mono text-text-primary">/partners/v1/trips/from-vehicle-count</code>
            </div>
            <p className="text-sm text-text-secondary">Create a trip with a vehicle count. Called by CLASS (Crew HOTAC system).</p>

            <div className="bg-ops-sidebar rounded p-3 text-xs border border-ops-sidebar/80">
              <p className="text-white/80 mb-2">Request:</p>
              <pre className="text-white overflow-x-auto">{`{
  "customerId": "C1",
  "vehicleType": "Sedan",
  "vehicleCount": 3,
  "scheduleDate": "2025-06-11",
  "pickupAddress": "HAL Airport, BLR",
  "pickupLat": 13.1939,
  "pickupLng": 77.6425,
  "dropAddress": "Marathahalli, BLR",
  "dropLat": 13.0285,
  "dropLng": 77.7597,
  "autoAssign": true,
  "reference": "CLASS-JUN-001"
}`}</pre>
            </div>

            <div className="bg-success/10 border border-success/30 rounded p-3 text-xs">
              <p className="text-success mb-2">Response (Success):</p>
              <pre className="text-text-primary overflow-x-auto">{`{
  "result": {
    "tripId": "TR-5678"
  }
}`}</pre>
            </div>
          </div>
        </div>
      </Card>

      {/* Webhooks */}
      <Card padding="lg" header={<h3 className="font-semibold text-text-primary">🪝 Webhook Events</h3>}>
        <div className="space-y-4 text-sm">
          <p className="text-text-secondary">Your webhook endpoint receives POST requests for these events:</p>

          <div className="space-y-3">
            {["TRIP_CREATED", "TRIP_CONFIRMED", "TRIP_ASSIGNED", "TRIP_IN_PROGRESS", "TRIP_COMPLETED", "TRIP_CANCELLED"].map((event) => (
              <div key={event} className="bg-ops-bg rounded p-3 space-y-1 border border-border">
                <div className="flex items-center gap-2">
                  <Badge variant="blue">{event}</Badge>
                </div>
                <p className="text-xs text-text-secondary">{event.replace("_", " ").toLowerCase()} event fired</p>
              </div>
            ))}
          </div>

          <div className="bg-ops-sidebar rounded p-3 text-xs border border-ops-sidebar/80">
            <p className="text-white/80 mb-2">Webhook Payload:</p>
            <pre className="text-white overflow-x-auto">{`{
  "event": "TRIP_CONFIRMED",
  "tripId": "TR-1234",
  "customerId": "C1",
  "createdVia": "API_PAX",
  "status": "CONFIRMED",
  "timestamp": "2025-06-10T10:30:00Z"
}`}</pre>
          </div>
        </div>
      </Card>

      {/* Rate Limits */}
      <Card padding="lg" header={<h3 className="font-semibold text-text-primary">⚡ Rate Limiting</h3>}>
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-text-secondary">Per Minute:</p>
              <p className="text-lg font-bold text-text-primary">60 requests</p>
            </div>
            <div>
              <p className="text-text-secondary">Per Hour:</p>
              <p className="text-lg font-bold text-text-primary">1,000 requests</p>
            </div>
          </div>

          <div className="bg-alert-amber/10 border border-alert-amber/30 rounded p-3">
            <p className="text-alert-amber text-xs">
              When rate limited, the response includes a <code>Retry-After</code> header indicating when to retry.
            </p>
          </div>
        </div>
      </Card>

      {/* Best Practices */}
      <Card padding="lg" header={<h3 className="font-semibold text-text-primary">✅ Best Practices</h3>}>
        <ul className="space-y-2 text-sm text-text-secondary">
          <li className="flex gap-2">
            <span>✓</span>
            <span>Always validate coordinates and addresses before sending requests</span>
          </li>
          <li className="flex gap-2">
            <span>✓</span>
            <span>Include a unique reference ID for idempotency and debugging</span>
          </li>
          <li className="flex gap-2">
            <span>✓</span>
            <span>Implement webhook endpoint with 200 OK response and short timeout</span>
          </li>
          <li className="flex gap-2">
            <span>✓</span>
            <span>Log all webhook deliveries for audit trail and debugging</span>
          </li>
          <li className="flex gap-2">
            <span>✓</span>
            <span>Handle retries gracefully using idempotency keys</span>
          </li>
          <li className="flex gap-2">
            <span>✓</span>
            <span>Test in sandbox mode before production</span>
          </li>
        </ul>
      </Card>
    </div>
  );
};

ApiDocumentation.displayName = "ApiDocumentation";
