import { AddonService, AddonType } from "@/lib/types";

export function validateAddonTypesUnique(addons: AddonService[]): boolean {
  const types = new Set<AddonType>();
  for (const addon of addons) {
    if (types.has(addon.type)) {
      return false;
    }
    types.add(addon.type);
  }
  return true;
}

export function isDocumentExpired(expiryDate: string | undefined): boolean {
  if (!expiryDate) return false;
  return new Date(expiryDate) < new Date();
}

export function isDocumentExpiringSoon(expiryDate: string | undefined, days: number = 30): boolean {
  if (!expiryDate) return false;
  const expiry = new Date(expiryDate);
  const today = new Date();
  const diffTime = expiry.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays >= 0 && diffDays <= days;
}

export function getDocumentStatus(expiryDate: string | undefined): "valid" | "expiring" | "expired" {
  if (!expiryDate) return "valid";
  if (isDocumentExpired(expiryDate)) return "expired";
  if (isDocumentExpiringSoon(expiryDate)) return "expiring";
  return "valid";
}
