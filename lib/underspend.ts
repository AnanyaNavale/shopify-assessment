import { formatCents } from "@/lib/catalog";
import type { AdjustedBudget, RebalanceResult } from "@/lib/rebalance";

export type UnderspendChoice = {
  listingId: string;
  quantity: number;
  kind: "fund" | "move";
};

export function underspendSurplus(item: AdjustedBudget): number {
  if (!item.enabled || !item.cart || item.comparison !== "under") {
    return 0;
  }
  return Math.max(0, item.originalMinCents - item.cart.totalCents);
}

export function underspendRecipient(
  items: AdjustedBudget[],
  itemId: string,
): AdjustedBudget | null {
  const sorted = items
    .filter((item) => item.enabled && !item.cut && item.currentMaxCents !== null)
    .sort((a, b) => a.priority - b.priority);
  const index = sorted.findIndex((item) => item.id === itemId);
  if (index < 0) {
    return null;
  }
  return sorted[index + 1] ?? sorted[index - 1] ?? null;
}

export function applyUnderspend(
  result: RebalanceResult,
  choices: Record<string, UnderspendChoice>,
): { result: RebalanceResult; houseFundCents: number } {
  const items = result.items.map((item) => ({ ...item }));
  let houseFundCents = 0;

  for (const item of items) {
    const choice = choices[item.id];
    const surplus = underspendSurplus(item);
    if (!choice || !item.cart || surplus <= 0) {
      continue;
    }
    if (choice.listingId !== item.cart.listing.id || choice.quantity !== item.cart.quantity) {
      continue;
    }

    const nextMin = item.cart.totalCents;
    const nextMax =
      item.currentMaxCents === null
        ? null
        : Math.max(nextMin, item.currentMaxCents - surplus);
    item.currentMinCents = nextMin;
    item.currentMaxCents = nextMax;
    item.currentLabel = rangeLabel(nextMin, nextMax);
    item.slashed = true;
    item.comparison = "within";

    if (choice.kind === "fund") {
      houseFundCents += surplus;
      item.underspendNote = `Saved ${formatCents(surplus)} to the house fund.`;
      continue;
    }

    const recipient = underspendRecipient(items, item.id);
    if (!recipient || recipient.currentMaxCents === null) {
      houseFundCents += surplus;
      item.underspendNote = `Saved ${formatCents(surplus)} to the house fund.`;
      continue;
    }
    recipient.currentMaxCents += surplus;
    recipient.currentLabel = rangeLabel(recipient.currentMinCents, recipient.currentMaxCents);
    recipient.slashed = true;
    item.underspendNote = `Added ${formatCents(surplus)} to ${recipient.name.toLowerCase()}.`;
  }

  return {
    houseFundCents,
    result: {
      ...result,
      items,
      roomLabel: roomLabel(items),
    },
  };
}

function rangeLabel(minCents: number, maxCents: number | null): string {
  if (maxCents === null) {
    return `${formatCents(minCents)}+`;
  }
  if (minCents === maxCents) {
    return formatCents(minCents);
  }
  return `${formatCents(minCents)}–${formatCents(maxCents)}`;
}

function roomLabel(items: AdjustedBudget[]): string {
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
  if (open) {
    return `${formatCents(roomMin)}+`;
  }
  return rangeLabel(roomMin, roomMax);
}
