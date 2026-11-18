import {
  formatBandLabel,
  formatCents,
  getChecklistTemplate,
  getListings,
  getPriceBands,
  getShippingAllowance,
  type CatalogContext,
  type PriceBand,
} from "@/lib/catalog";

const ITEM_PLURAL: Record<string, string> = {
  couch: "couches",
  chairs: "chairs",
  "coffee-table": "coffee tables",
  cabinet: "cabinets",
  "couch-pillows": "couch pillows",
  "chair-pillows": "chair pillows",
  "additional-pillows": "additional pillows",
  "side-tables": "side tables",
  "wall-painting": "wall paintings",
  lamp: "lamps",
  books: "books",
  candles: "candles",
  posters: "posters",
};

export type ChartBand = {
  index: number;
  label: string;
  generalCount: number;
  filteredCount: number | null;
  matchCount: number;
  marketRemainder: number;
  matchShare: number | null;
  highlighted: boolean;
};

export type BudgetRange = {
  bandLabel: string;
  quantity: number;
  perUnitLabel: string;
  shippingCents: number;
  shippingLabel: string;
  totalMinCents: number;
  totalMaxCents: number | null;
  totalLabel: string;
};

export type ChartSummary =
  | { kind: "none"; text: string }
  | { kind: "mock-gap"; text: string }
  | { kind: "comparison"; text: string };

export type ChartModel = {
  bands: ChartBand[];
  hasFilteredCounts: boolean;
  ranges: BudgetRange[];
  summary: ChartSummary;
};

function dollarFloor(cents: number): number {
  return Math.floor(cents / 100) * 100;
}

function rangeTotals(
  minCents: number,
  maxCents: number | null,
  quantity: number,
  shippingCents: number,
): { totalMinCents: number; totalMaxCents: number | null; totalLabel: string } {
  if (quantity <= 0) {
    return { totalMinCents: 0, totalMaxCents: 0, totalLabel: formatCents(0) };
  }
  const totalMinCents = dollarFloor(minCents) * quantity + shippingCents;
  if (maxCents === null) {
    return { totalMinCents, totalMaxCents: null, totalLabel: `${formatCents(totalMinCents)}+` };
  }
  const totalMaxCents = dollarFloor(maxCents) * quantity + shippingCents;
  return {
    totalMinCents,
    totalMaxCents,
    totalLabel: `${formatCents(totalMinCents)}–${formatCents(totalMaxCents)}`,
  };
}

export function formatRoomTotal(
  ranges: { totalMinCents: number; totalMaxCents: number | null }[],
): string {
  if (ranges.length === 0) {
    return formatCents(0);
  }
  const totalMinCents = ranges.reduce((sum, range) => sum + range.totalMinCents, 0);
  if (ranges.some((range) => range.totalMaxCents === null)) {
    return `${formatCents(totalMinCents)}+`;
  }
  const totalMaxCents = ranges.reduce((sum, range) => sum + (range.totalMaxCents ?? 0), 0);
  return `${formatCents(totalMinCents)}–${formatCents(totalMaxCents)}`;
}

function middleIndex(bandCount: number): number {
  return Math.floor((bandCount - 1) / 2);
}

function highlightedIndexes(
  bands: PriceBand[],
  itemId: string,
  context: CatalogContext,
  hasFilteredCounts: boolean,
): number[] {
  if (!hasFilteredCounts) {
    return [middleIndex(bands.length)];
  }

  const matchCounts = bands.map((band) =>
    Math.min(band.filteredCount ?? 0, band.generalCount),
  );
  const tallest = Math.max(...matchCounts);
  const candidates = bands
    .filter((_, index) => matchCounts[index] === tallest)
    .map((band) => band.index);

  if (candidates.length <= 1) {
    return candidates;
  }

  const scored = candidates.map((index) => {
    const { preferred } = getListings(itemId, index, context);
    if (preferred.length === 0) {
      return { index, rating: null as number | null };
    }
    const rating =
      preferred.reduce((sum, listing) => sum + listing.rating, 0) / preferred.length;
    return { index, rating };
  });
  const rated = scored.filter((entry) => entry.rating !== null);
  if (rated.length === 0) {
    return candidates;
  }
  const best = Math.max(...rated.map((entry) => entry.rating as number));
  return scored.filter((entry) => entry.rating === best).map((entry) => entry.index);
}

function comparisonText(
  itemId: string,
  context: CatalogContext,
  bands: PriceBand[],
  highlighted: number[],
): string {
  const plural = ITEM_PLURAL[itemId] ?? "items";
  const taste = [context.color, context.material]
    .map((value) => value?.trim().toLowerCase())
    .filter(Boolean)
    .join(" ");
  const highlightedBands = bands.filter((band) => highlighted.includes(band.index));
  const bandPhrase =
    highlightedBands.length === 1
      ? `the ${formatBandLabel(highlightedBands[0].minCents, highlightedBands[0].maxCents)} band`
      : `the ${highlightedBands
          .map((band) => formatBandLabel(band.minCents, band.maxCents))
          .join(" and ")} bands`;
  const matchTotal = bands.reduce(
    (sum, band) => sum + Math.min(band.filteredCount ?? 0, band.generalCount),
    0,
  );
  const matchHere = highlightedBands.reduce(
    (sum, band) => sum + Math.min(band.filteredCount ?? 0, band.generalCount),
    0,
  );
  const marketTotal = bands.reduce((sum, band) => sum + band.generalCount, 0);
  const lowestHighlighted = Math.min(...highlighted);
  const below = bands
    .filter((band) => band.index < lowestHighlighted)
    .reduce((sum, band) => sum + band.generalCount, 0);
  const highlightedGeneral = highlightedBands.reduce((sum, band) => sum + band.generalCount, 0);
  const above = marketTotal - below - highlightedGeneral;
  const belowPct = Math.round((below / marketTotal) * 100);
  const abovePct = Math.round((above / marketTotal) * 100);
  const availability = `Most ${taste} ${plural} are in ${bandPhrase} (~${matchHere} of ~${matchTotal}).`;

  if (belowPct >= 60) {
    return `${availability} Most ${taste} ${plural} are priced higher than about ${belowPct}% of all ${plural}. Other materials or colors may have more options at a lower price.`;
  }
  if (abovePct >= 60) {
    return `${availability} Most ${taste} ${plural} are priced lower than about ${abovePct}% of all ${plural}. More options are also available at higher prices.`;
  }
  return `${availability} Most ${taste} ${plural} are priced higher than about ${belowPct}% of all ${plural}.`;
}

function gapText(context: CatalogContext): string {
  const hasMaterial = Boolean(context.material?.trim());
  const hasColor = Boolean(context.color?.trim());
  const subject =
    hasMaterial && hasColor ? "this material and color" : hasMaterial ? "this material" : "this color";
  return `The mock catalog has no filtered counts for ${subject}. The chart shows the whole market, and the middle band is highlighted.`;
}

export function getChartModel(
  itemId: string,
  context: CatalogContext,
  quantity?: number,
): ChartModel {
  const item = getChecklistTemplate().items.find((entry) => entry.id === itemId);
  if (!item) {
    throw new Error(`No checklist item "${itemId}".`);
  }

  const bands = getPriceBands(itemId, context);
  const hasFilteredCounts = bands.some((band) => band.filteredCount !== null);
  const highlighted = highlightedIndexes(bands, itemId, context, hasFilteredCounts);
  const shipping = getShippingAllowance(itemId);
  const hasPreference = Boolean(context.material?.trim() || context.color?.trim());

  const chartBands: ChartBand[] = bands.map((band) => {
    const matchCount = hasFilteredCounts
      ? Math.min(band.filteredCount ?? 0, band.generalCount)
      : 0;
    return {
      index: band.index,
      label: band.label,
      generalCount: band.generalCount,
      filteredCount: band.filteredCount,
      matchCount,
      marketRemainder: band.generalCount - matchCount,
      matchShare:
        hasFilteredCounts && band.generalCount > 0
          ? Math.round((matchCount / band.generalCount) * 100)
          : null,
      highlighted: highlighted.includes(band.index),
    };
  });

  const itemQuantity = quantity ?? item.defaultQuantity;
  const ranges: BudgetRange[] = bands
    .filter((band) => highlighted.includes(band.index))
    .map((band) => ({
      bandLabel: band.label,
      quantity: itemQuantity,
      perUnitLabel: band.label,
      shippingCents: shipping.amountCents,
      shippingLabel: shipping.label,
      ...rangeTotals(band.minCents, band.maxCents, itemQuantity, shipping.amountCents),
    }));

  let summary: ChartSummary;
  if (!hasPreference) {
    summary = {
      kind: "none",
      text: "No material or color entered, so the middle band is highlighted.",
    };
  } else if (!hasFilteredCounts) {
    summary = { kind: "mock-gap", text: gapText(context) };
  } else {
    summary = {
      kind: "comparison",
      text: comparisonText(itemId, context, bands, highlighted),
    };
  }

  return { bands: chartBands, hasFilteredCounts, ranges, summary };
}
