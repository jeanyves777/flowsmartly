/**
 * NAP consistency checker for ListSmartly.
 * Compares a listing's data against the master profile.
 */

interface ProfileData {
  businessName: string;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  address?: string | null;
}

interface ListingData {
  businessName?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  address?: string | null;
}

interface Inconsistency {
  field: string;
  expected: string;
  actual: string;
}

export function checkConsistency(
  profile: ProfileData,
  listing: ListingData
): { isConsistent: boolean; inconsistencies: Inconsistency[] } {
  const inconsistencies: Inconsistency[] = [];
  const fields: (keyof ProfileData)[] = ["businessName", "phone", "email", "website", "address"];

  for (const field of fields) {
    const expected = normalize(profile[field]);
    const actual = normalize(listing[field]);
    if (!expected) continue; // Skip if master has no value
    if (!actual) continue; // Skip if listing has no value (can't compare)
    if (expected !== actual) {
      inconsistencies.push({
        field,
        expected: profile[field] || "",
        actual: listing[field] || "",
      });
    }
  }

  return { isConsistent: inconsistencies.length === 0, inconsistencies };
}

function normalize(value: string | null | undefined): string {
  if (!value) return "";
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}
