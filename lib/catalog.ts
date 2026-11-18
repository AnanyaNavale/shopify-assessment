import bandsJson from "@/data/bands.json";
import checklistJson from "@/data/checklist.json";
import listingsJson from "@/data/listings.json";
import shippingJson from "@/data/shipping.json";

/**
 * Mock catalog shaped like Catalog search results.
 * Postal code is accepted on every read and does not filter this dataset.
 * Filtered band counts exist only for couch + material "velvet" + color "blue".
 */

export type CatalogContext = {
  postalCode?: string;
  material?: string;
  color?: string;
};

export type ChecklistTier = {
  id: number;
  name: string;
};

export type ChecklistItem = {
  id: string;
  name: string;
  tierId: number;
  defaultQuantity: number;
  quantityNote: string | null;
  enabledByDefault: boolean;
};

export type PriceBand = {
  index: number;
  minCents: number;
  maxCents: number | null;
  label: string;
  generalCount: number;
  filteredCount: number | null;
};

export type Listing = {
  id: string;
  itemId: string;
  bandIndex: number;
  title: string;
  url: string;
  priceCents: number;
  listPriceCents: number | null;
  imageUrl: string;
  runningLow: boolean;
  rating: number;
  sellerName: string;
  matchesPreference: boolean;
  automaticPromotion: { amountOffCents: number } | null;
};

export type ListingGroups = {
  preferred: Listing[];
  others: Listing[];
};

type BandRecord = {
  minCents: number;
  maxCents: number | null;
  generalCount: number;
  filteredCount?: number;
};

const checklist = checklistJson;
const bands = bandsJson;
const listings = listingsJson.listings as Listing[];
const shipping = shippingJson;

const PREFERENCE_SLICE = bands.preferenceSlice;

function normalize(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

function matchesPreferenceSlice(
  itemId: string,
  context: CatalogContext | undefined,
): boolean {
  if (!context?.material && !context?.color) {
    return false;
  }
  return (
    itemId === PREFERENCE_SLICE.itemId &&
    normalize(context.material) === PREFERENCE_SLICE.material &&
    normalize(context.color) === PREFERENCE_SLICE.color
  );
}

export function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function formatBandDollars(cents: number): string {
  return formatCents(Math.floor(cents / 100) * 100);
}

export function formatBandLabel(minCents: number, maxCents: number | null): string {
  if (maxCents === null) {
    return `${formatBandDollars(minCents)}+`;
  }
  return `${formatBandDollars(minCents)}–${formatBandDollars(maxCents)}`;
}

function itemBands(itemId: string): BandRecord[] {
  const item = bands.items.find((entry) => entry.itemId === itemId);
  if (!item) {
    throw new Error(`No mock price bands for item "${itemId}".`);
  }
  return item.bands;
}

export function getChecklistTemplate(): {
  source: "mock";
  room: string;
  tiers: ChecklistTier[];
  items: ChecklistItem[];
} {
  return {
    source: "mock",
    room: checklist.room,
    tiers: checklist.tiers,
    items: checklist.items,
  };
}

export function getPriceBands(
  itemId: string,
  context?: CatalogContext,
): PriceBand[] {
  const applyFilter = matchesPreferenceSlice(itemId, context);
  return itemBands(itemId).map((band, index) => ({
    index,
    minCents: band.minCents,
    maxCents: band.maxCents,
    label: formatBandLabel(band.minCents, band.maxCents),
    generalCount: band.generalCount,
    filteredCount: applyFilter ? (band.filteredCount ?? null) : null,
  }));
}

export function getListings(
  itemId: string,
  bandIndex: number,
  context?: CatalogContext,
): ListingGroups {
  const bandCount = itemBands(itemId).length;
  if (bandIndex < 0 || bandIndex >= bandCount) {
    throw new Error(`Band ${bandIndex} is outside the mock bands for "${itemId}".`);
  }

  const inBand = listings.filter(
    (listing) => listing.itemId === itemId && listing.bandIndex === bandIndex,
  );
  const applyFilter = matchesPreferenceSlice(itemId, context);

  if (!applyFilter) {
    return { preferred: [], others: inBand };
  }

  return {
    preferred: inBand
      .filter((listing) => listing.matchesPreference)
      .sort((a, b) => b.rating - a.rating),
    others: inBand.filter((listing) => !listing.matchesPreference),
  };
}

export function getCheapestPriceCents(itemId: string): number | null {
  const prices = listings
    .filter((listing) => listing.itemId === itemId)
    .map((listing) => listing.priceCents);
  if (prices.length === 0) {
    return null;
  }
  return Math.min(...prices);
}

export function getShippingAllowance(itemId: string): {
  source: "mock";
  amountCents: number;
  label: string;
} {
  const amountCents = shipping.allowancesCents[itemId as keyof typeof shipping.allowancesCents];
  if (amountCents === undefined) {
    throw new Error(`No mock shipping allowance for item "${itemId}".`);
  }
  return {
    source: "mock",
    amountCents,
    label: shipping.label,
  };
}

export function getMockCatalogSummary(): {
  source: "mock";
  itemCount: number;
  bandCountPerItem: number;
  couchListingCount: number;
  promotionCount: number;
} {
  const couchListingCount = listings.filter((listing) => listing.itemId === "couch").length;
  const promotionCount = listings.filter((listing) => listing.automaticPromotion).length;
  return {
    source: "mock",
    itemCount: checklist.items.length,
    bandCountPerItem: itemBands("couch").length,
    couchListingCount,
    promotionCount,
  };
}
