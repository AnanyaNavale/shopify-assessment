"use client";

import { useState, type FormEvent } from "react";
import { CartView } from "@/app/cart-view";
import { BudgetPanel } from "@/app/checklist";
import { ListingsSection } from "@/app/listings";
import { UnderspendDialog } from "@/app/underspend-dialog";
import { PriceChart } from "@/app/price-chart";
import { formatCents, type ChecklistItem, type ChecklistTier, type Listing } from "@/lib/catalog";
import { getChartModel } from "@/lib/market";
import { buildAdjustedBudget } from "@/lib/plan";
import { underspendRecipient, underspendSurplus, type UnderspendChoice } from "@/lib/underspend";

type CatalogSummary = {
  itemCount: number;
  bandCountPerItem: number;
  couchListingCount: number;
  promotionCount: number;
};

type ItemPreference = { material: string; color: string };

export function Planner({
  items,
  tiers,
  summary,
}: {
  items: ChecklistItem[];
  tiers: ChecklistTier[];
  summary: CatalogSummary;
}) {
  const [postalCode, setPostalCode] = useState<string | null>(null);
  const [postalDraft, setPostalDraft] = useState("");
  const [itemId, setItemId] = useState(
    items.find((item) => item.id === "couch")?.id ?? items[0]?.id ?? "",
  );
  const [preferences, setPreferences] = useState<Record<string, ItemPreference>>({});
  const [quantities, setQuantities] = useState<Record<string, number>>(() =>
    Object.fromEntries(items.map((item) => [item.id, item.defaultQuantity])),
  );
  const [enabled, setEnabled] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(items.map((item) => [item.id, item.enabledByDefault])),
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
  const [dismissed, setDismissed] = useState<Record<string, string>>({});
  const [showCart, setShowCart] = useState(false);

  const material = preferences[itemId]?.material ?? "";
  const color = preferences[itemId]?.color ?? "";

  const trimmedPostal = postalDraft.trim();
  const itemName = items.find((item) => item.id === itemId)?.name ?? "Item";
  const materialText = material.trim() || "—";
  const colorText = color.trim() || "—";

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
    postalCode: postalCode ?? "",
    cart,
    choices,
  });
  const prompt = plan.items
    .filter((item) => underspendSurplus(item) > 0)
    .sort((a, b) => a.priority - b.priority)
    .find((item) => {
      const key = `${item.cart?.listing.id}:${item.cart?.quantity}`;
      return dismissed[item.id] !== key;
    });
  const promptRecipient = prompt ? underspendRecipient(plan.items, prompt.id) : null;

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

  function savePostalCode(event: FormEvent) {
    event.preventDefault();
    if (!trimmedPostal) {
      return;
    }
    setPostalCode(trimmedPostal);
  }

  return (
    <div className="min-w-[1120px]">
      <header className="flex h-14 items-center justify-between border-b border-neutral-200 bg-white px-6">
        <div className="flex items-baseline gap-3">
          <span className="text-lg font-semibold tracking-tight">Shop</span>
          <span className="text-sm text-neutral-500">Room budget</span>
        </div>
        <div className="flex items-center gap-4">
          {postalCode ? (
            <button
              type="button"
              onClick={() => setShowCart((current) => !current)}
              className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white"
            >
              {showCart ? "Back to room" : "Review cart"}
            </button>
          ) : null}
          <p className="text-sm text-neutral-500">
            {postalCode
              ? `Postal code ${postalCode} · Living room · mock catalog`
              : "Living room · mock catalog"}
          </p>
        </div>
      </header>

      {postalCode === null ? (
        <main className="mx-auto max-w-md p-6">
          <form
            onSubmit={savePostalCode}
            className="rounded-lg border border-neutral-200 bg-white p-5"
          >
            <label htmlFor="postal-code" className="text-sm font-medium text-neutral-900">
              Postal code
            </label>
            <input
              id="postal-code"
              value={postalDraft}
              onChange={(event) => setPostalDraft(event.target.value)}
              autoComplete="postal-code"
              className="mt-4 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={!trimmedPostal}
              className="mt-4 rounded-md bg-neutral-900 px-4 py-2 text-sm text-white disabled:bg-neutral-300"
            >
              Continue
            </button>
          </form>
        </main>
      ) : showCart ? (
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
        />
      ) : (
        <div className="mx-auto flex max-w-7xl gap-6 p-6">
          <main className="flex min-w-0 flex-1 flex-col gap-4">
            <section className="rounded-lg border border-neutral-200 bg-white p-5">
              <h2 className="text-sm font-medium text-neutral-900">Preference input</h2>
              <div className="mt-4 grid gap-4">
                <label className="grid gap-1 text-sm" htmlFor="item-type">
                  <span className="font-medium text-neutral-900">Item</span>
                  <select
                    id="item-type"
                    value={itemId}
                    onChange={(event) => setItemId(event.target.value)}
                    required
                    className="rounded-md border border-neutral-300 px-3 py-2"
                  >
                    {items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-sm" htmlFor="material">
                  <span className="font-medium text-neutral-900">Material (optional)</span>
                  <input
                    id="material"
                    value={material}
                    onChange={(event) =>
                      setPreferences((current) => ({
                        ...current,
                        [itemId]: {
                          material: event.target.value,
                          color: current[itemId]?.color ?? "",
                        },
                      }))
                    }
                    className="rounded-md border border-neutral-300 px-3 py-2"
                  />
                </label>
                <label className="grid gap-1 text-sm" htmlFor="color">
                  <span className="font-medium text-neutral-900">Color (optional)</span>
                  <input
                    id="color"
                    value={color}
                    onChange={(event) =>
                      setPreferences((current) => ({
                        ...current,
                        [itemId]: {
                          material: current[itemId]?.material ?? "",
                          color: event.target.value,
                        },
                      }))
                    }
                    className="rounded-md border border-neutral-300 px-3 py-2"
                  />
                </label>
              </div>
              <p className="mt-4 text-sm text-neutral-600">
                Postal code {postalCode} · {itemName} · Material {materialText} · Color{" "}
                {colorText}
              </p>
            </section>

            <PriceChartSection
              itemId={itemId}
              postalCode={postalCode}
              material={material}
              color={color}
              selectedBandIndex={selectedBandIndex}
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
                      material: material.trim() || undefined,
                      color: color.trim() || undefined,
                    }).bands[selectedBandIndex]?.label ?? null
              }
              context={{
                postalCode,
                material: material.trim() || undefined,
                color: color.trim() || undefined,
              }}
              selectedListingId={cart[itemId]?.id ?? null}
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

          <aside className="flex w-96 shrink-0 flex-col gap-4">
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
                  setCart((current) => {
                    const next = { ...current };
                    delete next[id];
                    return next;
                  });
                }
              }}
            />
            <section className="rounded-lg border border-neutral-200 bg-white p-5">
              <h2 className="text-sm font-medium text-neutral-900">House fund</h2>
              <p className="mt-3 text-sm text-neutral-800">{formatCents(plan.houseFundCents)}</p>
              <p className="mt-1 text-xs text-neutral-500">
                Saved from underspending, reserved for other rooms.
              </p>
            </section>
            <p className="px-1 text-xs leading-5 text-neutral-500">
              Mock data loaded: {summary.itemCount} checklist items, {summary.bandCountPerItem}{" "}
              price bands each, {summary.couchListingCount} couch listings, {summary.promotionCount}{" "}
              automatic promotion.
            </p>
          </aside>
        </div>
      )}
      {postalCode && prompt ? (
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

function PriceChartSection({
  itemId,
  postalCode,
  material,
  color,
  selectedBandIndex,
  onSelectBand,
  quantity,
}: {
  itemId: string;
  postalCode: string;
  material: string;
  color: string;
  selectedBandIndex: number | null;
  onSelectBand: (index: number) => void;
  quantity: number;
}) {
  const chart = getChartModel(
    itemId,
    {
      postalCode,
      material: material.trim() || undefined,
      color: color.trim() || undefined,
    },
    quantity,
  );

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5">
      <h2 className="text-sm font-medium text-neutral-900">Price chart</h2>
      <p className="mt-1 text-xs text-neutral-500">
        Number of products. Counts are estimates.
      </p>
      <div className="mt-4">
        <PriceChart
          bands={chart.bands}
          showMatches={chart.hasFilteredCounts}
          onSelectBand={onSelectBand}
        />
      </div>
      <ul className="mt-4 grid gap-1 text-sm text-neutral-700">
        {chart.bands.map((band) => (
          <li key={band.index}>
            <button
              type="button"
              onClick={() => onSelectBand(band.index)}
              className={`text-left ${band.highlighted ? "font-medium text-neutral-900" : ""}`}
            >
              {band.highlighted ? "Highlighted · " : ""}
              {band.index === selectedBandIndex ? "Showing listings · " : ""}
              {band.label} · ~{band.generalCount}
              {band.matchShare !== null
                ? ` · ~${band.matchCount} matches (${band.matchShare}% of this band)`
                : ""}
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-4 grid gap-2 text-sm text-neutral-800">
        {chart.ranges.map((range) => (
          <p key={range.bandLabel}>
            Budget range {range.totalLabel}. {range.perUnitLabel} × {range.quantity}, plus{" "}
            {formatCents(range.shippingCents)} shipping. {range.shippingLabel}.
          </p>
        ))}
      </div>
      <div className="mt-4">
        <h3 className="text-sm font-medium text-neutral-900">Summary</h3>
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
