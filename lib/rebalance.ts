import { formatCents, type Listing } from "@/lib/catalog";

export type CartLine = {
  listing: Listing;
  quantity: number;
  discountCents: number;
  shippingCents: number;
  shippingLabel: string;
  totalCents: number;
};

export type AdjustedBudget = {
  id: string;
  name: string;
  enabled: boolean;
  originalMinCents: number;
  originalMaxCents: number | null;
  currentMinCents: number;
  currentMaxCents: number | null;
  originalLabel: string;
  currentLabel: string;
  slashed: boolean;
  cut: boolean;
  cart: CartLine | null;
  comparison: "within" | "under" | "over" | null;
  priority: number;
  underspendNote: string | null;
};

export type RebalanceResult = {
  items: AdjustedBudget[];
  tradeoff: string | null;
  overByCents: number;
  roomLabel: string;
  originalRoomLabel: string;
};

type WorkingItem = AdjustedBudget & {
  priority: number;
  cheapestCents: number;
};

function rangeLabel(minCents: number, maxCents: number | null): string {
  if (minCents === 0 && maxCents === 0) {
    return formatCents(0);
  }
  if (maxCents === null) {
    return `${formatCents(minCents)}+`;
  }
  return `${formatCents(minCents)}–${formatCents(maxCents)}`;
}

export function cartLine(
  listing: Listing,
  quantity: number,
  shippingCents: number,
  shippingLabel: string,
): CartLine {
  const discountCents = listing.automaticPromotion?.amountOffCents ?? 0;
  const merchandise = Math.max(0, listing.priceCents * Math.max(quantity, 0) - discountCents);
  const shipping = quantity > 0 ? shippingCents : 0;
  return {
    listing,
    quantity,
    discountCents,
    shippingCents: shipping,
    shippingLabel,
    totalCents: merchandise + shipping,
  };
}

export function rebalance(
  plan: {
    id: string;
    name: string;
    priority: number;
    enabled: boolean;
    minCents: number;
    maxCents: number | null;
    cheapestCents: number;
    cart: CartLine | null;
  }[],
): RebalanceResult {
  const items: WorkingItem[] = plan.map((item) => ({
    id: item.id,
    name: item.name,
    priority: item.priority,
    enabled: item.enabled,
    cheapestCents: item.cheapestCents,
    originalMinCents: item.minCents,
    originalMaxCents: item.maxCents,
    currentMinCents: item.enabled ? item.minCents : 0,
    currentMaxCents: item.enabled ? item.maxCents : 0,
    originalLabel: rangeLabel(item.minCents, item.maxCents),
    currentLabel: rangeLabel(item.enabled ? item.minCents : 0, item.enabled ? item.maxCents : 0),
    slashed: false,
    cut: false,
    cart: item.enabled ? item.cart : null,
    comparison: null,
    underspendNote: null,
  }));

  const touched: string[] = [];
  const purchases: string[] = [];
  let overByCents = 0;

  const buyers = items
    .filter((item) => item.enabled && item.cart && item.cart.quantity > 0)
    .sort((a, b) => a.priority - b.priority);

  for (const buyer of buyers) {
    const estimate = buyer.cart?.totalCents ?? 0;
    const ceiling = buyer.currentMaxCents;
    if (ceiling === null || estimate <= ceiling) {
      buyer.comparison = ceiling !== null && estimate < buyer.currentMinCents ? "under" : "within";
      continue;
    }

    buyer.comparison = "over";
    buyer.slashed = true;
    purchases.push(buyer.name);
    let deficit = estimate - ceiling;
    const donors = items
      .filter(
        (donor) =>
          donor.enabled &&
          !donor.cut &&
          donor.id !== buyer.id &&
          donor.priority > buyer.priority &&
          donor.currentMaxCents !== null &&
          !donor.cart,
      )
      .sort((a, b) => b.priority - a.priority);

    for (const donor of donors) {
      if (deficit <= 0) {
        break;
      }
      const max = donor.currentMaxCents as number;
      const cheapest = donor.cheapestCents;
      const reducible = Math.max(0, max - cheapest);
      if (reducible > 0 && deficit > 0) {
        const take = Math.min(deficit, reducible);
        donor.currentMaxCents = max - take;
        if (donor.currentMaxCents < donor.currentMinCents) {
          donor.currentMinCents = Math.min(donor.currentMaxCents, cheapest);
        }
        donor.slashed = true;
        deficit -= take;
        if (!touched.includes(donor.name)) {
          touched.push(donor.name);
        }
      }
      if (deficit > 0 && donor.currentMaxCents !== null && donor.currentMaxCents > 0) {
        deficit -= donor.currentMaxCents;
        donor.currentMinCents = 0;
        donor.currentMaxCents = 0;
        donor.cut = true;
        donor.slashed = true;
        if (!touched.includes(donor.name)) {
          touched.push(donor.name);
        }
      }
    }
    if (deficit > 0) {
      overByCents += deficit;
    }
  }

  overByCents = absorbRoomIncrease(items, touched);

  for (const item of items) {
    item.currentLabel = rangeLabel(item.currentMinCents, item.currentMaxCents);
  }

  const originalRoomLabel = roomLabel(
    items
      .filter((item) => item.enabled)
      .map((item) => ({
        totalMinCents: item.originalMinCents,
        totalMaxCents: item.originalMaxCents,
      })),
  );

  let roomMin = 0;
  let roomMax = 0;
  let open = false;
  for (const item of items) {
    if (!item.enabled || item.cut) {
      continue;
    }
    if (item.comparison === "over" && item.cart) {
      roomMin += item.cart.totalCents;
      roomMax += item.cart.totalCents;
      continue;
    }
    roomMin += item.currentMinCents;
    if (item.currentMaxCents === null) {
      open = true;
    } else {
      roomMax += item.currentMaxCents;
    }
  }
  const adjustedRoomLabel = open ? `${formatCents(roomMin)}+` : rangeLabel(roomMin, roomMax);

  const tradeoff =
    purchases.length === 0
      ? null
      : tradeoffText(purchases, touched, overByCents);

  return {
    items,
    tradeoff,
    overByCents,
    roomLabel: overByCents > 0 ? originalRoomLabel : adjustedRoomLabel,
    originalRoomLabel,
  };
}

export function roomTotalIncreased(items: AdjustedBudget[]): boolean {
  const before = roomBounds(items, "original");
  const after = roomBounds(items, "current");
  if (before.open || after.open) {
    if (after.open && !before.open) {
      return true;
    }
    if (!after.open && before.open) {
      return after.min > before.min;
    }
    return after.min > before.min;
  }
  return after.min > before.min || after.max > before.max;
}

function roomBounds(
  items: AdjustedBudget[],
  field: "original" | "current",
): { min: number; max: number; open: boolean } {
  let min = 0;
  let max = 0;
  let open = false;
  for (const item of items) {
    if (!item.enabled) {
      continue;
    }
    if (field === "current" && item.cut) {
      continue;
    }
    if (field === "current" && item.comparison === "over" && item.cart) {
      min += item.cart.totalCents;
      max += item.cart.totalCents;
      continue;
    }
    const itemMin = field === "original" ? item.originalMinCents : item.currentMinCents;
    const itemMax = field === "original" ? item.originalMaxCents : item.currentMaxCents;
    min += itemMin;
    if (itemMax === null) {
      open = true;
    } else {
      max += itemMax;
    }
  }
  return { min, max, open };
}

function absorbRoomIncrease(items: WorkingItem[], touched: string[]): number {
  if (!items.some((item) => item.comparison === "over")) {
    return 0;
  }
  const before = roomBounds(items, "original");
  const highestOver = Math.min(
    ...items.filter((item) => item.comparison === "over").map((item) => item.priority),
  );
  const donors = items
    .filter(
      (item) =>
        item.enabled &&
        !item.cut &&
        !item.cart &&
        item.priority > highestOver &&
        item.currentMaxCents !== null,
    )
    .sort((a, b) => b.priority - a.priority);

  for (const donor of donors) {
    const after = roomBounds(items, "current");
    const extraMin = Math.max(0, after.min - before.min);
    const extraMax = !before.open && !after.open ? Math.max(0, after.max - before.max) : 0;
    if (extraMin === 0 && extraMax === 0) {
      return 0;
    }
    if (donor.currentMaxCents === null) {
      continue;
    }
    const reduce = Math.max(extraMin, extraMax);
    donor.currentMaxCents = Math.max(0, donor.currentMaxCents - reduce);
    donor.currentMinCents = Math.max(0, donor.currentMinCents - extraMin);
    if (donor.currentMaxCents < donor.currentMinCents) {
      donor.currentMinCents = donor.currentMaxCents;
    }
    donor.slashed = true;
    if (!touched.includes(donor.name)) {
      touched.push(donor.name);
    }
    if (donor.currentMaxCents < donor.cheapestCents) {
      donor.currentMinCents = 0;
      donor.currentMaxCents = 0;
      donor.cut = true;
    }
  }

  const settled = roomBounds(items, "current");
  const minLeft = Math.max(0, settled.min - before.min);
  const maxLeft = !before.open && !settled.open ? Math.max(0, settled.max - before.max) : 0;
  return Math.max(minLeft, maxLeft);
}

function roomLabel(ranges: { totalMinCents: number; totalMaxCents: number | null }[]): string {
  if (ranges.length === 0) {
    return formatCents(0);
  }
  const min = ranges.reduce((sum, range) => sum + range.totalMinCents, 0);
  if (ranges.some((range) => range.totalMaxCents === null)) {
    return `${formatCents(min)}+`;
  }
  const max = ranges.reduce((sum, range) => sum + (range.totalMaxCents ?? 0), 0);
  return rangeLabel(min, max);
}

function tradeoffText(purchases: string[], touched: string[], overByCents: number): string {
  const names = (list: string[]) => list.map((name) => name.toLowerCase());
  const bought =
    purchases.length === 1 ? `this ${names(purchases)[0]}` : names(purchases).join(" and ");
  const loweredNames = names([...touched].reverse());
  const lowered =
    loweredNames.length === 0
      ? null
      : loweredNames.length === 1
        ? loweredNames[0]
        : `${loweredNames.slice(0, -1).join(", ")} and ${loweredNames[loweredNames.length - 1]}`;
  const first = lowered
    ? `If you get ${bought}, you may need to go lower on your ${lowered} to stay within budget.`
    : `If you get ${bought}, the lower-priority items cannot cover the difference.`;
  if (overByCents > 0) {
    return `${first} The room total is over by ${formatCents(overByCents)}.`;
  }
  return first;
}

export function cartSummary(result: RebalanceResult): { tone: "within" | "over"; lines: string[] } {
  if (result.overByCents > 0) {
    const buyer = result.items
      .filter((item) => item.comparison === "over")
      .sort((a, b) => a.priority - b.priority)[0];
    const donor = result.items
      .filter((item) => item.enabled && !item.cut && item.id !== buyer?.id)
      .sort((a, b) => b.priority - a.priority)[0];
    const suggestion =
      buyer && donor
        ? `Try cutting the ${donor.name.toLowerCase()} to reserve more for your ${buyer.name.toLowerCase()}.`
        : "The lower-priority items are already cut, so they cannot cover this.";
    return {
      tone: "over",
      lines: [`Your cart is ${formatCents(result.overByCents)} over the room budget.`, suggestion],
    };
  }

  const underCents = result.items.reduce((sum, item) => {
    if (!item.cart || item.comparison === "over" || item.comparison === null) {
      return sum;
    }
    if (item.currentMaxCents !== null) {
      return sum + Math.max(0, item.currentMaxCents - item.cart.totalCents);
    }
    if (item.cart.totalCents < item.originalMinCents) {
      return sum + (item.originalMinCents - item.cart.totalCents);
    }
    return sum;
  }, 0);

  const lines = ["Your cart value lands within the budgeted range."];
  if (underCents > 0) {
    const left = formatCents(underCents);
    lines.push(
      `You have ${left} left over from this room. Upgrade something here, or save it to your house fund for another room?`,
    );
  }
  return { tone: "within", lines };
}
