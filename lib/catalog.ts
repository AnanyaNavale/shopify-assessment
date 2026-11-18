import bandsJson from "@/data/bands.json";
import checklistJson from "@/data/checklist.json";
import liveGeneralsJson from "@/data/live-generals.json";
import liveSlicesJson from "@/data/live-slices.json";
import shippingJson from "@/data/shipping.json";

/**
 * Catalog reads. Listings come only from saved Catalog searches.
 * A color uses the same query as the general search, plus a Color filter.
 * Material is not part of the query. Shipping, cart, and checkout stay mock.
 * Saved searches are limited to products that ship to 94582.
 * The postal code typed in the app does not re-query these files.
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
  rating: number | null;
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

type SavedSlice = {
  itemId: string;
  color: string;
  bands: { filteredCount: number }[];
  listings: Listing[];
};

const checklist = checklistJson;
const bands = bandsJson;
const shipping = shippingJson;

const generalItems = liveGeneralsJson.items as {
  itemId: string;
  bands: { generalCount: number }[];
  listings?: Listing[];
}[];
const listings: Listing[] = generalItems.flatMap((item) => item.listings ?? []);

const generalCounts = new Map(
  generalItems.map((item) => [item.itemId, item.bands.map((band) => band.generalCount)]),
);

const savedSlices = liveSlicesJson.slices as SavedSlice[];

function normalize(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

function findSavedSlice(
  itemId: string,
  context: CatalogContext | undefined,
): SavedSlice | null {
  const color = normalize(context?.color);
  if (!color) {
    return null;
  }
  return (
    savedSlices.find((slice) => slice.itemId === itemId && slice.color === color) ?? null
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
    throw new Error(`No price bands for item "${itemId}".`);
  }
  const counts = generalCounts.get(itemId);
  return item.bands.map((band, index) => ({
    minCents: band.minCents,
    maxCents: band.maxCents,
    generalCount: counts?.[index] ?? band.generalCount,
  }));
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
  const slice = findSavedSlice(itemId, context);
  return itemBands(itemId).map((band, index) => ({
    index,
    minCents: band.minCents,
    maxCents: band.maxCents,
    label: formatBandLabel(band.minCents, band.maxCents),
    generalCount: band.generalCount,
    filteredCount: slice ? (slice.bands[index]?.filteredCount ?? null) : null,
  }));
}

export function getListings(
  itemId: string,
  bandIndex: number,
  context?: CatalogContext,
): ListingGroups {
  const bandCount = itemBands(itemId).length;
  if (bandIndex < 0 || bandIndex >= bandCount) {
    throw new Error(`Band ${bandIndex} is outside the bands for "${itemId}".`);
  }

  const inBand = listings.filter(
    (listing) => listing.itemId === itemId && listing.bandIndex === bandIndex,
  );
  const slice = findSavedSlice(itemId, context);

  if (!slice) {
    return { preferred: [], others: inBand };
  }

  const preferred = slice.listings
    .filter((listing) => listing.bandIndex === bandIndex)
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  const preferredIds = new Set(preferred.map((listing) => listing.id));
  return {
    preferred,
    others: inBand.filter((listing) => !preferredIds.has(listing.id) && !listing.matchesPreference),
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
  couchSource: "catalog" | "mock";
  itemCount: number;
  bandCountPerItem: number;
  couchListingCount: number;
  promotionCount: number;
} {
  const couchListingCount = listings.filter((listing) => listing.itemId === "couch").length;
  const promotionCount = listings.filter((listing) => listing.automaticPromotion).length;
  return {
    source: "mock",
    couchSource: generalCounts.has("couch") ? "catalog" : "mock",
    itemCount: checklist.items.length,
    bandCountPerItem: itemBands("couch").length,
    couchListingCount,
    promotionCount,
  };
}
