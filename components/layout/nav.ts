import {
  Activity,
  AlertTriangle,
  Building2,
  CarFront,
  LayoutDashboard,
  MapPin,
  Route,
  Settings2,
  Truck,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  group: "Monitor" | "Directory" | "Insights";
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Overview", href: "/", icon: LayoutDashboard, group: "Monitor" },
  { label: "Needs attention", href: "/attention", icon: AlertTriangle, group: "Monitor" },
  { label: "Tenants", href: "/tenants", icon: Building2, group: "Directory" },
  { label: "Vendors", href: "/vendors", icon: Truck, group: "Directory" },
  { label: "Trips", href: "/trips", icon: Route, group: "Directory" },
  { label: "Live map", href: "/map", icon: MapPin, group: "Monitor" },
  { label: "Fleet", href: "/fleet", icon: CarFront, group: "Insights" },
  { label: "Money", href: "/money", icon: Wallet, group: "Insights" },
  { label: "Configuration gaps", href: "/config-gaps", icon: Settings2, group: "Insights" },
  { label: "Activity", href: "/activity", icon: Activity, group: "Insights" },
];

export const NAV_GROUPS: NavItem["group"][] = ["Monitor", "Directory", "Insights"];

export function activeItem(pathname: string): NavItem | undefined {
  return (
    NAV_ITEMS.find((item) => item.href === pathname) ??
    NAV_ITEMS.find((item) => item.href !== "/" && pathname.startsWith(item.href))
  );
}
