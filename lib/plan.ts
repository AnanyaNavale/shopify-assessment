import {
  getCheapestPriceCents,
  getShippingAllowance,
  type ChecklistItem,
  type ChecklistTier,
  type Listing,
} from "@/lib/catalog";
import { getChartModel } from "@/lib/market";
import { cartLine, rebalance, type RebalanceResult } from "@/lib/rebalance";
import { applyUnderspend, type UnderspendChoice } from "@/lib/underspend";

export type ItemPreference = { color: string; material?: string };

export type AcceptedBudget = { minCents: number; maxCents: number | null };

export type BudgetPlan = RebalanceResult & { houseFundCents: number };

export function buildAdjustedBudget({
  tiers,
  items,
  order,
  quantities,
  enabled,
  preferences,
  postalCode,
  cart,
  choices = {},
  accepted = {},
}: {
  tiers: ChecklistTier[];
  items: ChecklistItem[];
  order: Record<number, string[]>;
  quantities: Record<string, number>;
  enabled: Record<string, boolean>;
  preferences: Record<string, ItemPreference>;
  postalCode: string;
  cart: Record<string, Listing>;
  choices?: Record<string, UnderspendChoice>;
  accepted?: Record<string, AcceptedBudget>;
}): BudgetPlan {
  const priorityOf = new Map<string, number>();
  let rank = 0;
  for (const tier of tiers) {
    for (const id of order[tier.id] ?? []) {
      priorityOf.set(id, rank);
      rank += 1;
    }
  }

  const balanced = rebalance(
    items.map((item) => {
      const quantity = quantities[item.id] ?? 0;
      const ranges = getChartModel(
        item.id,
        {
          postalCode,
          material: preferences[item.id]?.material?.trim() || undefined,
          color: preferences[item.id]?.color.trim() || undefined,
        },
        quantity,
      ).ranges;
      const saved = accepted[item.id];
      const minCents = saved
        ? saved.minCents
        : ranges.length === 0
          ? 0
          : Math.min(...ranges.map((range) => range.totalMinCents));
      const maxCents = saved
        ? saved.maxCents
        : ranges.length === 0
          ? 0
          : ranges.some((range) => range.totalMaxCents === null)
            ? null
            : Math.max(...ranges.map((range) => range.totalMaxCents ?? 0));
      const shipping = getShippingAllowance(item.id);
      const unit = getCheapestPriceCents(item.id);
      const listing = cart[item.id];
      return {
        id: item.id,
        name: item.name,
        priority: priorityOf.get(item.id) ?? rank,
        enabled: enabled[item.id] ?? false,
        minCents,
        maxCents,
        cheapestCents:
          quantity <= 0 ? 0 : unit === null ? minCents : unit * quantity + shipping.amountCents,
        cart: listing ? cartLine(listing, quantity, shipping.amountCents, shipping.label) : null,
      };
    }),
  );
  const applied = applyUnderspend(balanced, choices);
  return { ...applied.result, houseFundCents: applied.houseFundCents };
}
