"use client";

import { useEffect, useRef, useState } from "react";
import { CartView } from "@/app/cart-view";
import { BudgetPanel } from "@/app/checklist";
import { ListingsSection } from "@/app/listings";
import { UnderspendDialog } from "@/app/underspend-dialog";
import { PriceChart } from "@/app/price-chart";
import { formatCents, type ChecklistItem, type ChecklistTier, type Listing } from "@/lib/catalog";
import { getChartModel } from "@/lib/market";
import { buildAdjustedBudget, type AcceptedBudget } from "@/lib/plan";
import {
  choiceSurplus,
  underspendRecipient,
  underspendSurplus,
  type UnderspendChoice,
} from "@/lib/underspend";

type CatalogSummary = {
  itemCount: number;
  bandCountPerItem: number;
  couchListingCount: number;
  promotionCount: number;
  couchSource: "catalog" | "mock";
};

type ItemPreference = { color: string };

const COLOR_FILTERS = [
  "Black",
  "Blue",
  "White",
  "Gold",
  "Silver",
  "Beige",
  "Brown",
  "Gray",
  "Green",
  "Orange",
  "Pink",
  "Purple",
  "Red",
  "Yellow",
  "Navy",
  "Rose gold",
  "Clear",
  "Bronze",
  "Multicolor",
];

const COLOR_SWATCHES: Record<string, string> = {
  Black: "#171717",
  Blue: "#2563eb",
  White: "#ffffff",
  Gold: "#d4af37",
  Silver: "#c0c0c0",
  Beige: "#e6d3b3",
  Brown: "#8b5a2b",
  Gray: "#9ca3af",
  Green: "#16a34a",
  Orange: "#f97316",
  Pink: "#ec4899",
  Purple: "#7c3aed",
  Red: "#dc2626",
  Yellow: "#eab308",
  Navy: "#1e3a5f",
  "Rose gold": "#b76e79",
  Clear: "linear-gradient(135deg, #ffffff 46%, #a3a3a3 46%, #a3a3a3 54%, #ffffff 54%)",
  Bronze: "#cd7f32",
  Multicolor: "linear-gradient(135deg, #dc2626, #eab308, #16a34a, #2563eb)",
};

function ColorSwatch({ color }: { color: string }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-3.5 w-3.5 shrink-0 rounded-sm border border-neutral-300"
      style={{ background: COLOR_SWATCHES[color] ?? "#ffffff" }}
    />
  );
}

export function Planner({
  items,
  tiers,
  summary,
}: {
  items: ChecklistItem[];
  tiers: ChecklistTier[];
  summary: CatalogSummary;
}) {
  const [postalCode, setPostalCode] = useState("");
  const [itemId, setItemId] = useState("");
  const [preferences, setPreferences] = useState<Record<string, ItemPreference>>({});
  const [quantities, setQuantities] = useState<Record<string, number>>(() =>
    Object.fromEntries(items.map((item) => [item.id, item.defaultQuantity])),
  );
  const [enabled, setEnabled] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(items.map((item) => [item.id, false])),
  );
  const [order, setOrder] = useState<Record<number, string[]>>(() => {
    const next: Record<number, string[]> = {};
    for (const item of items) {
      next[item.tierId] ??= [];
      next[item.tierId].push(item.id);
    }
    return next;
  });
  const [selectedBandIndex, setSelectedBandIndex] = useState<number | null>(null);
  const [cart, setCart] = useState<Record<string, Listing>>({});
  const [choices, setChoices] = useState<Record<string, UnderspendChoice>>({});
  const [accepted, setAccepted] = useState<Record<string, AcceptedBudget>>({});
  const [dismissed, setDismissed] = useState<Record<string, string>>({});
  const [showCart, setShowCart] = useState(false);

  const color = preferences[itemId]?.color ?? "";

  function forgetChoice(id: string) {
    setChoices((current) => {
      if (!current[id]) {
        return current;
      }
      const next = { ...current };
      delete next[id];
      return next;
    });
    setDismissed((current) => {
      if (!current[id]) {
        return current;
      }
      const next = { ...current };
      delete next[id];
      return next;
    });
  }

  const plan = buildAdjustedBudget({
    tiers,
    items,
    order,
    quantities,
    enabled,
    preferences,
    postalCode,
    cart,
    choices,
    accepted,
  });
  const prompt = plan.items
    .filter((item) => underspendSurplus(item) > 0)
    .sort((a, b) => a.priority - b.priority)
    .find((item) => {
      const key = `${item.cart?.listing.id}:${item.cart?.quantity}`;
      return dismissed[item.id] !== key;
    });
  const promptRecipient = prompt ? underspendRecipient(plan.items, prompt.id) : null;

  function setAsNewBudget() {
    const next: Record<string, AcceptedBudget> = {};
    for (const item of plan.items) {
      if (!item.enabled) {
        continue;
      }
      if (item.comparison === "over" && item.cart) {
        next[item.id] = { minCents: item.cart.totalCents, maxCents: item.cart.totalCents };
      } else if (item.cut) {
        next[item.id] = { minCents: 0, maxCents: 0 };
      } else {
        next[item.id] = { minCents: item.currentMinCents, maxCents: item.currentMaxCents };
      }
    }
    setAccepted(next);
  }

  function choose(kind: UnderspendChoice["kind"]) {
    if (!prompt?.cart) {
      return;
    }
    setChoices((current) => ({
      ...current,
      [prompt.id]: {
        listingId: prompt.cart?.listing.id ?? "",
        quantity: prompt.cart?.quantity ?? 0,
        kind,
      },
    }));
  }

  function chooseRoom(kind: UnderspendChoice["kind"]) {
    setChoices((current) => {
      const next = { ...current };
      for (const item of plan.items) {
        if (!item.cart || choiceSurplus(item) <= 0) {
          continue;
        }
        next[item.id] = {
          listingId: item.cart.listing.id,
          quantity: item.cart.quantity,
          kind,
        };
      }
      return next;
    });
  }

  return (
    <div className="flex min-h-0 min-w-[1120px] flex-1 flex-col">
      <header className="flex h-14 items-center justify-between border-b border-neutral-200 bg-white px-6">
        <div className="flex items-baseline gap-3">
          <span className="text-lg font-semibold tracking-tight">Shop</span>
          <span className="text-sm text-neutral-500">Room budget · Living room</span>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-neutral-700" htmlFor="postal-code">
            Postal code
            <input
              id="postal-code"
              value={postalCode}
              onChange={(event) => setPostalCode(event.target.value)}
              autoComplete="postal-code"
              placeholder="Optional"
              className="w-28 rounded-full border border-neutral-300 px-3 py-1 text-sm text-neutral-900 outline-none focus:outline-none"
            />
          </label>
          <button
            type="button"
            onClick={() => setShowCart((current) => !current)}
            className="rounded-full bg-neutral-900 px-3 py-1.5 text-sm text-white"
          >
            {showCart ? "Back to room" : "Review cart"}
          </button>
        </div>
      </header>

      {showCart ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <CartView
            tiers={tiers}
            items={items}
            order={order}
            quantities={quantities}
            enabled={enabled}
            preferences={preferences}
            postalCode={postalCode}
            cart={cart}
            choices={choices}
            accepted={accepted}
            onChooseRoom={chooseRoom}
          />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1">
          <aside className="flex h-full min-h-0 w-96 shrink-0 flex-col gap-4 overflow-y-auto border-r border-neutral-200 bg-white p-4">
            <BudgetPanel
              tiers={tiers}
              items={items}
              order={order}
              quantities={quantities}
              enabled={enabled}
              preferences={preferences}
              postalCode={postalCode}
              cart={cart}
              choices={choices}
              accepted={accepted}
              onSetBudget={setAsNewBudget}
              onOrderChange={(tierId, itemIds) =>
                setOrder((current) => ({ ...current, [tierId]: itemIds }))
              }
              onQuantityChange={(id, quantity) => {
                forgetChoice(id);
                setQuantities((current) => ({ ...current, [id]: quantity }));
              }}
              onEnabledChange={(id, on) => {
                setEnabled((current) => ({ ...current, [id]: on }));
                if (!on) {
                  forgetChoice(id);
                  setAccepted((current) => {
                    if (!current[id]) {
                      return current;
                    }
                    const next = { ...current };
                    delete next[id];
                    return next;
                  });
                  setCart((current) => {
                    const next = { ...current };
                    delete next[id];
                    return next;
                  });
                  if (itemId === id) {
                    setItemId("");
                    setSelectedBandIndex(null);
                  }
                }
              }}
              selectedItemId={itemId}
              onSelectItem={(id) => {
                setItemId(id);
                setSelectedBandIndex(null);
              }}
            />
            <hr className="border-neutral-200" />
            <section>
              <h2 className="text-base font-semibold text-neutral-900">House fund</h2>
              <p className="mt-1 text-sm text-neutral-800">{formatCents(plan.houseFundCents)}</p>
              <p className="mt-1 text-xs text-neutral-500">
                Saved from underspending, reserved for other rooms.
              </p>
            </section>
            <hr className="border-neutral-200" />
            <p className="px-1 text-xs leading-5 text-neutral-500">
              {summary.couchSource === "catalog"
                ? `Saved searches ship to 94582. They use the item words only, plus a color filter when one is saved. Saved colors: white and blue couches, brown coffee tables, and green pillows. Chairs are saved as armchairs and cabinets as cabinets, with no color filter. ${summary.couchListingCount} couch listings are saved from the general couch search. The postal code you type does not run a new search. Shipping, cart, and checkout are mock.`
                : `Mock data loaded: ${summary.itemCount} checklist items, ${summary.bandCountPerItem} price bands each, ${summary.couchListingCount} couch listings, ${summary.promotionCount} automatic promotion.`}
            </p>
          </aside>
          <main className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto p-6">
            <PriceChartSection
              itemId={itemId}
              postalCode={postalCode}
              color={color}
              onColorChange={(next) =>
                setPreferences((current) => ({
                  ...current,
                  [itemId]: { color: next },
                }))
              }
              onSelectBand={setSelectedBandIndex}
              quantity={quantities[itemId] ?? 1}
            />

            <ListingsSection
              itemId={itemId}
              bandIndex={selectedBandIndex}
              bandLabel={
                selectedBandIndex === null
                  ? null
                  : getChartModel(itemId, {
                      postalCode,
                      color: color.trim() || undefined,
                    }).bands[selectedBandIndex]?.label ?? null
              }
              context={{
                postalCode,
                color: color.trim() || undefined,
              }}
              selectedListing={cart[itemId] ?? null}
              onSelectListing={(listing) => {
                forgetChoice(itemId);
                if (!listing) {
                  setCart((current) => {
                    const next = { ...current };
                    delete next[itemId];
                    return next;
                  });
                  return;
                }
                setCart((current) => ({ ...current, [itemId]: listing }));
                setEnabled((current) => ({ ...current, [itemId]: true }));
              }}
            />
          </main>
        </div>
      )}
      {prompt ? (
        <UnderspendDialog
          key={`${prompt.id}:${prompt.cart?.listing.id}:${prompt.cart?.quantity}`}
          item={prompt}
          recipient={promptRecipient}
          onMove={() => choose("move")}
          onSave={() => choose("fund")}
          onDismiss={() => {
            if (!prompt.cart) {
              return;
            }
            setDismissed((current) => ({
              ...current,
              [prompt.id]: `${prompt.cart?.listing.id}:${prompt.cart?.quantity}`,
            }));
          }}
        />
      ) : null}
    </div>
  );
}

function ColorMenu({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    function closeOnOutsidePointer(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [open]);

  return (
    <div ref={menuRef} className="relative flex items-center gap-2 text-sm text-neutral-700">
      <span>Color:</span>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((current) => !current)}
        className="relative cursor-pointer rounded-full border border-neutral-300 bg-white px-3 py-2 text-left"
      >
        <span className="invisible flex items-center gap-2 text-sm font-normal" aria-hidden="true">
          <span className="inline-block h-3.5 w-3.5" />
          Multicolor
        </span>
        <span className="absolute inset-0 flex items-center gap-2 px-3 text-sm font-normal text-neutral-700">
          {value ? <ColorSwatch color={value} /> : null}
          {value || "All"}
        </span>
      </button>
      {open ? (
        <div className="absolute top-full right-0 z-30 mt-2 w-[32rem] rounded-lg border border-neutral-200 bg-white p-3 shadow-lg">
          <div
            className="grid gap-1"
            style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}
            role="listbox"
            aria-label="Color"
          >
            {COLOR_FILTERS.map((color) => {
              const selected = color.toLowerCase() === value.trim().toLowerCase();
              return (
                <button
                  key={color}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onChange(selected ? "" : color);
                    setOpen(false);
                  }}
                  className={`flex cursor-pointer items-center gap-2 rounded-full px-2 py-1.5 text-left text-sm hover:bg-neutral-50 ${
                    selected ? "bg-neutral-100 font-medium text-neutral-900" : "text-neutral-800"
                  }`}
                >
                  <ColorSwatch color={color} />
                  {color}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PriceChartSection({
  itemId,
  postalCode,
  color,
  onColorChange,
  onSelectBand,
  quantity,
}: {
  itemId: string;
  postalCode: string;
  color: string;
  onColorChange: (color: string) => void;
  onSelectBand: (index: number) => void;
  quantity: number;
}) {
  const [chartAnimationKey, setChartAnimationKey] = useState(0);
  const chartChange = useRef({ itemId, color });

  useEffect(() => {
    const previous = chartChange.current;
    const itemChanged = previous.itemId !== itemId;
    const colorChanged = previous.color !== color;
    const clearedToAll = color.trim() === "" && previous.color.trim() !== "";
    const switchedItem = itemChanged && previous.itemId !== "";
    if (switchedItem || (colorChanged && !clearedToAll)) {
      setChartAnimationKey((key) => key + 1);
    }
    chartChange.current = { itemId, color };
  }, [itemId, color]);

  if (!itemId) {
    return (
      <section className="rounded-lg border border-neutral-200 bg-white p-5">
        <h2 className="text-base font-semibold text-neutral-900">Price chart</h2>
        <p className="mt-4 text-sm text-neutral-600">
          Add an item to your checklist on the left, then select it to see the corresponding price chart.
        </p>
      </section>
    );
  }

  const chart = getChartModel(
    itemId,
    {
      postalCode,
      color: color.trim() || undefined,
    },
    quantity,
  );

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-neutral-900">Price chart</h2>
          <p className="mt-1 text-xs text-neutral-500">
            Number of products. Counts are estimates.
          </p>
          {chart.hasFilteredCounts ? (
            <div className="mt-2 flex gap-4 text-xs text-neutral-600">
              <span className="flex items-center gap-1">
                <span className="inline-block h-2.5 w-2.5 bg-blue-600" /> Matches
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2.5 w-2.5 bg-stone-300" /> Rest of market
              </span>
            </div>
          ) : null}
        </div>
        <ColorMenu value={color} onChange={onColorChange} />
      </div>
      <div className="mt-2">
        <PriceChart
          key={chartAnimationKey}
          bands={chart.bands}
          showMatches={chart.hasFilteredCounts}
          onSelectBand={onSelectBand}
        />
      </div>
      <div className="mt-2 grid gap-2 text-sm text-neutral-800">
        {chart.ranges.map((range) => (
          <p key={range.bandLabel}>
            Budget range {range.totalLabel}. {range.perUnitLabel} × {range.quantity}, plus{" "}
            {formatCents(range.shippingCents)} shipping. {range.shippingLabel}.
          </p>
        ))}
      </div>
      <div className="mt-4">
        <h3 className="text-base font-semibold text-neutral-900">Summary</h3>
        <p className="mt-2 text-sm leading-6 text-neutral-700">{chart.summary.text}</p>
        {chart.summary.kind === "comparison" ? (
          <p className="mt-2 text-xs text-neutral-500">
            Prototype note. In the product, this sentence would be written by a model.
          </p>
        ) : null}
      </div>
    </section>
  );
}
