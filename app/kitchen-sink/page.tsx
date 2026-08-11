"use client";

import React, { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { FormField } from "@/components/ui/FormField";
import { Badge } from "@/components/ui/Badge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Drawer } from "@/components/ui/Drawer";
import { Modal } from "@/components/ui/Modal";
import { Tabs } from "@/components/ui/Tabs";
import { PII } from "@/components/ui/PII";
import { useToastStore } from "@/stores/toastStore";
import { TripStatus, VehicleStatus } from "@/lib/types";

type DemoRow = Record<string, unknown> & {
  id: string;
  name: string;
  status: string;
  value: number;
};

const DEMO_DATA: DemoRow[] = [
  { id: "1", name: "Trip ABC123", status: "CONFIRMED", value: 1250 },
  { id: "2", name: "Trip DEF456", status: "IN_PROGRESS", value: 1500 },
  { id: "3", name: "Trip GHI789", status: "COMPLETED", value: 950 },
  { id: "4", name: "Trip JKL012", status: "DRAFT", value: 1100 },
  { id: "5", name: "Trip MNO345", status: "ASSIGNED", value: 1300 },
  { id: "6", name: "Trip PQR678", status: "CANCELLED", value: 0 },
  { id: "7", name: "Trip STU901", status: "BILLED", value: 1200 },
  { id: "8", name: "Trip VWX234", status: "CONFIRMED", value: 1400 },
  { id: "9", name: "Trip YZA567", status: "IN_PROGRESS", value: 1100 },
  { id: "10", name: "Trip BCD890", status: "COMPLETED", value: 1350 },
];

const TRIP_STATUSES: TripStatus[] = ["DRAFT", "CONFIRMED", "ASSIGNED", "IN_PROGRESS", "COMPLETED", "BILLED", "CANCELLED"];
const VEHICLE_STATUSES: VehicleStatus[] = [
  "PENDING",
  "ASSIGNED",
  "DRIVER_ACCEPTED",
  "DRIVER_REJECTED",
  "EN_ROUTE_PICKUP",
  "AT_PICKUP",
  "PAX_PICKED",
  "IN_TRANSIT",
  "AT_DROP",
  "PAX_DROPPED",
  "COMPLETED",
  "NO_SHOW",
  "BREAKDOWN",
  "ACCIDENT",
  "VEHICLE_SWAP",
  "DELAYED",
  "SOS",
  "CANCELLED",
];

export default function KitchenSinkPage() {
  const addToast = useToastStore((s) => s.addToast);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("tab1");
  const [inputValue, setInputValue] = useState("");
  const [selectValue, setSelectValue] = useState("opt1");

  const columns: Column[] = [
    { key: "id", header: "ID", sortable: true },
    { key: "name", header: "Name", sortable: true },
    { key: "status", header: "Status", sortable: true, render: (val) => <StatusBadge status={val as TripStatus} /> },
    { key: "value", header: "Value ($)", sortable: true, render: (val) => `$${val}` },
  ];

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold text-text-primary">UI Kit Kitchen Sink</h1>

      {/* Buttons Section */}
      <Card header={<h2 className="font-semibold">Buttons</h2>} padding="lg">
        <div className="space-y-4">
          <div className="flex gap-4 flex-wrap">
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
          </div>
          <div className="flex gap-4 flex-wrap">
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
          </div>
          <div className="flex gap-4">
            <Button loading>Loading</Button>
            <Button disabled>Disabled</Button>
          </div>
        </div>
      </Card>

      {/* Forms Section */}
      <Card header={<h2 className="font-semibold">Forms</h2>} padding="lg">
        <div className="space-y-4">
          <Input
            label="Standard Input"
            placeholder="Enter text..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
          />
          <Input
            label="Input with Error"
            placeholder="This field has an error..."
            error="This is required"
          />
          <Select
            label="Standard Select"
            value={selectValue}
            onChange={(e) => setSelectValue(e.target.value)}
            options={[
              { value: "opt1", label: "Option 1" },
              { value: "opt2", label: "Option 2" },
              { value: "opt3", label: "Option 3" },
            ]}
          />
          <FormField label="Form Field" hint="This is a hint" required>
            <Input placeholder="Wrapped input" />
          </FormField>
        </div>
      </Card>

      {/* Badges Section */}
      <Card header={<h2 className="font-semibold">Badges</h2>} padding="lg">
        <div className="flex gap-2 flex-wrap">
          <Badge variant="default">Default</Badge>
          <Badge variant="blue">Blue</Badge>
          <Badge variant="green">Green</Badge>
          <Badge variant="amber">Amber</Badge>
          <Badge variant="red">Red</Badge>
          <Badge variant="purple">Purple</Badge>
          <Badge variant="teal">Teal</Badge>
        </div>
      </Card>

      {/* Status Badges Section */}
      <Card header={<h2 className="font-semibold">Trip Status Badges</h2>} padding="lg">
        <div className="grid grid-cols-4 gap-3">
          {TRIP_STATUSES.map((status) => (
            <div key={status} className="flex items-center gap-2">
              <StatusBadge status={status} />
            </div>
          ))}
        </div>
      </Card>

      <Card header={<h2 className="font-semibold">Vehicle Status Badges</h2>} padding="lg">
        <div className="grid grid-cols-4 gap-3">
          {VEHICLE_STATUSES.map((status) => (
            <div key={status} className="flex items-center gap-2">
              <StatusBadge status={status} />
            </div>
          ))}
        </div>
      </Card>

      {/* DataTable Section */}
      <Card header={<h2 className="font-semibold">DataTable (Sortable & Paginated)</h2>} padding="lg">
        <DataTable
          columns={columns}
          data={DEMO_DATA}
          pageSize={5}
          emptyMessage="No trips available"
        />
      </Card>

      {/* Drawer Section */}
      <Card header={<h2 className="font-semibold">Drawer</h2>} padding="lg">
        <Button onClick={() => setDrawerOpen(true)}>Open Drawer</Button>
        <Drawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          title="Example Drawer"
          width="lg"
        >
          <div className="space-y-4">
            <p className="text-text-primary">This is a slide-over drawer panel.</p>
            <p className="text-text-secondary">Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>
            <Button variant="primary" onClick={() => setDrawerOpen(false)}>
              Close Drawer
            </Button>
          </div>
        </Drawer>
      </Card>

      {/* Modal Section */}
      <Card header={<h2 className="font-semibold">Modal</h2>} padding="lg">
        <Button onClick={() => setModalOpen(true)}>Open Modal</Button>
        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title="Example Modal"
          size="md"
        >
          <div className="space-y-4">
            <p className="text-text-primary">This is a centred modal dialog.</p>
            <p className="text-text-secondary">Press ESC to close or click the close button.</p>
            <Button variant="primary" onClick={() => setModalOpen(false)}>
              Close Modal
            </Button>
          </div>
        </Modal>
      </Card>

      {/* Tabs Section */}
      <Card header={<h2 className="font-semibold">Tabs</h2>} padding="lg">
        <Tabs
          tabs={[
            { id: "tab1", label: "Tab 1" },
            { id: "tab2", label: "Tab 2" },
            { id: "tab3", label: "Tab 3" },
          ]}
          activeTab={activeTab}
          onChange={setActiveTab}
        >
          {activeTab === "tab1" && <p className="text-text-primary">Content for Tab 1</p>}
          {activeTab === "tab2" && <p className="text-text-primary">Content for Tab 2</p>}
          {activeTab === "tab3" && <p className="text-text-primary">Content for Tab 3</p>}
        </Tabs>
      </Card>

      {/* Toast Section */}
      <Card header={<h2 className="font-semibold">Toast</h2>} padding="lg">
        <div className="flex gap-2 flex-wrap">
          <Button onClick={() => addToast("Success! Operation completed.", "success")}>
            Success Toast
          </Button>
          <Button onClick={() => addToast("Error! Something went wrong.", "error")}>
            Error Toast
          </Button>
          <Button onClick={() => addToast("Info: This is an informational message.", "info")}>
            Info Toast
          </Button>
        </div>
      </Card>

      {/* PII Section */}
      <Card header={<h2 className="font-semibold">PII (Personally Identifiable Information)</h2>} padding="lg">
        <div className="space-y-3">
          <div>
            <p className="text-sm text-text-secondary mb-1">Name:</p>
            <PII value="John Doe" type="name" />
          </div>
          <div>
            <p className="text-sm text-text-secondary mb-1">Phone:</p>
            <PII value="+919876543210" type="phone" />
          </div>
          <div>
            <p className="text-sm text-text-secondary mb-1">Email:</p>
            <PII value="john.doe@example.com" type="email" />
          </div>
          <div>
            <p className="text-sm text-text-secondary mb-1">Employee ID:</p>
            <PII value="EMP20241234" type="id" />
          </div>
          <div>
            <p className="text-sm text-text-secondary mb-1">PNR (Booking Reference):</p>
            <PII value="ABCDEF123456" type="pnr" />
          </div>
          <div>
            <p className="text-sm text-text-secondary mb-1">Licence Number:</p>
            <PII value="KA05AB1234" type="licence" />
          </div>
        </div>
      </Card>
    </div>
  );
}
