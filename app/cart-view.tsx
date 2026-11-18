"use client";

import { useState } from "react";
import { formatCents, type ChecklistItem, type ChecklistTier, type Listing } from "@/lib/catalog";
import { buildAdjustedBudget, type AcceptedBudget, type ItemPreference } from "@/lib/plan";
import { cartSummary, roomTotalIncreased, type AdjustedBudget } from "@/lib/rebalance";
import { choiceSurplus, underspendRecipient, type UnderspendChoice } from "@/lib/underspend";

export function CartView({
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
  onChooseRoom,
}: {
  tiers: ChecklistTier[];
  items: ChecklistItem[];
  order: Record<number, string[]>;
  quantities: Record<string, number>;
  enabled: Record<string, boolean>;
  preferences: Record<string, ItemPreference>;
  postalCode: string;
  cart: Record<string, Listing>;
  choices: Record<string, UnderspendChoice>;
  accepted: Record<string, AcceptedBudget>;
  onChooseRoom: (kind: UnderspendChoice["kind"]) => void;
}) {
  const adjusted = buildAdjustedBudget({
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
  const summary = cartSummary(adjusted);
  const onItems = adjusted.items.filter((item) => item.enabled).sort((a, b) => a.priority - b.priority);
  const selected = onItems.filter((item) => item.cart && !item.cut);
  const pending = onItems.filter((item) => !item.cart && !item.cut);
  const cut = onItems.filter((item) => item.cut);
  const selectedTotal = selected.reduce((sum, item) => sum + (item.cart?.totalCents ?? 0), 0);
  const groups = new Map<string, AdjustedBudget[]>();
  for (const item of selected) {
    const seller = item.cart?.listing.sellerName ?? "Seller";
    groups.set(seller, [...(groups.get(seller) ?? []), item]);
  }
  const over = summary.tone === "over";
  const leftoverItem = adjusted.items
    .filter((item) => choiceSurplus(item) > 0)
    .sort((a, b) => a.priority - b.priority)[0];
  const upgradeRecipient = leftoverItem ? underspendRecipient(adjusted.items, leftoverItem.id) : null;
  const [checkout, setCheckout] = useState(false);
  const [handedOff, setHandedOff] = useState<Record<string, true>>({});

  if (checkout) {
    return (
      <CheckoutView
        groups={[...groups.entries()]}
        handedOff={handedOff}
        houseFundCents={adjusted.houseFundCents}
        onBack={() => setCheckout(false)}
        onHandOff={(seller) => setHandedOff((current) => ({ ...current, [seller]: true }))}
      />
    );
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
      <section className="rounded-lg border border-neutral-200 bg-white p-5">
        <h2 className="text-base font-semibold text-neutral-900">Cart</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Mock cart for the living room. Checked listings are grouped by seller. Shipping is an
          allowance until checkout.
        </p>
        {selected.length === 0 ? (
          <p className="mt-4 text-sm text-neutral-600">No listings are checked yet.</p>
        ) : (
          <div className="mt-4 grid gap-6">
            {[...groups.entries()].map(([seller, lines]) => (
              <div key={seller}>
                <h3 className="text-base font-semibold text-neutral-900">{seller}</h3>
                <ul className="mt-2 divide-y divide-neutral-200">
                  {lines.map((item) => (
                    <CartLineRow key={item.id} item={item} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
        <p className="mt-4 text-sm text-neutral-800">
          Selected items {formatCents(selectedTotal)}
        </p>
        {selected.length > 0 ? (
          <button
            type="button"
            onClick={() => setCheckout(true)}
            className="mt-4 rounded-full bg-neutral-900 px-4 py-2 text-sm text-white"
          >
            Checkout
          </button>
        ) : null}
      </section>

      {pending.length > 0 ? (
        <section className="rounded-lg border border-neutral-200 bg-white p-5">
          <h2 className="text-base font-semibold text-neutral-900">Not selected yet</h2>
          <ul className="mt-3 grid gap-2 text-sm text-neutral-700">
            {pending.map((item) => (
              <li key={item.id}>
                {item.name}. Budget {item.originalLabel}.
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {cut.length > 0 ? (
        <section className="rounded-lg border border-neutral-200 bg-white p-5">
          <h2 className="text-base font-semibold text-neutral-900">Cut from the budget</h2>
          <ul className="mt-3 grid gap-2 text-sm text-neutral-700">
            {cut.map((item) => (
              <li key={item.id}>
                {item.name}.{" "}
                <span className="text-neutral-400 line-through">{item.originalLabel}</span> Cut
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-lg border border-neutral-200 bg-white p-5">
        <h2 className="text-base font-semibold text-neutral-900">Room total</h2>
        <p
          className={`mt-3 text-lg font-medium ${
            roomTotalIncreased(adjusted.items) ? "text-red-700" : over ? "text-neutral-800" : "text-green-700"
          }`}
        >
          {adjusted.roomLabel !== adjusted.originalRoomLabel ? (
            <>
              <span className="mr-2 font-normal text-neutral-400 line-through">
                {adjusted.originalRoomLabel}
              </span>
              {adjusted.roomLabel}
            </>
          ) : (
            adjusted.roomLabel
          )}
        </p>
        <p className="mt-3 text-sm text-neutral-800">House fund {formatCents(adjusted.houseFundCents)}</p>
        <p className="mt-1 text-xs text-neutral-500">
          Saved from underspending, reserved for other rooms.
        </p>
        <div className="mt-3 grid gap-2 text-sm leading-6 text-neutral-800">
          {summary.lines.map((line) => {
            const question = line.includes("left over from this room");
            const amount = question ? line.match(/^You have (\$[\d,]+) /)?.[1] : null;
            return (
              <div key={line}>
                <p>{line}</p>
                {question && amount ? (
                  <div className="mt-3 flex flex-col items-start gap-2">
                    {upgradeRecipient ? (
                      <button
                        type="button"
                        onClick={() => onChooseRoom("move")}
                        className="cursor-pointer rounded-full bg-neutral-900 px-4 py-2 text-sm text-white"
                      >
                        Add {amount} to {upgradeRecipient.name.toLowerCase()}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => onChooseRoom("fund")}
                      className="cursor-pointer rounded-full border border-neutral-300 px-4 py-2 text-sm text-neutral-900"
                    >
                      Save {amount} to the house fund
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}

function CheckoutView({
  groups,
  handedOff,
  houseFundCents,
  onBack,
  onHandOff,
}: {
  groups: [string, AdjustedBudget[]][];
  handedOff: Record<string, true>;
  houseFundCents: number;
  onBack: () => void;
  onHandOff: (seller: string) => void;
}) {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
      <section className="rounded-lg border border-neutral-200 bg-white p-5">
        <h2 className="text-base font-semibold text-neutral-900">Checkout</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Mock checkout. Each seller is handed off on its own. Nothing is charged, and the house
          fund does not move. Shipping stays an allowance.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="mt-4 rounded-full border border-neutral-300 px-3 py-1.5 text-sm text-neutral-900"
        >
          Back to cart
        </button>
      </section>
      {groups.map(([seller, lines]) => {
        const sellerTotal = lines.reduce((sum, item) => sum + (item.cart?.totalCents ?? 0), 0);
        const done = handedOff[seller] === true;
        return (
          <section key={seller} className="rounded-lg border border-neutral-200 bg-white p-5">
            <h2 className="text-base font-semibold text-neutral-900">{seller}</h2>
            <ul className="mt-2 divide-y divide-neutral-200">
              {lines.map((item) => (
                <CartLineRow key={item.id} item={item} />
              ))}
            </ul>
            <p className="mt-4 text-sm text-neutral-800">Seller total {formatCents(sellerTotal)}</p>
            {done ? (
              <p className="mt-3 text-sm text-neutral-800">
                Handed off to {seller}. Mock only. No order was placed.
              </p>
            ) : (
              <button
                type="button"
                onClick={() => onHandOff(seller)}
                className="mt-4 rounded-full bg-neutral-900 px-4 py-2 text-sm text-white"
              >
                Hand off to {seller}
              </button>
            )}
          </section>
        );
      })}
      <section className="rounded-lg border border-neutral-200 bg-white p-5">
        <h2 className="text-base font-semibold text-neutral-900">House fund</h2>
        <p className="mt-3 text-sm text-neutral-800">{formatCents(houseFundCents)}</p>
        <p className="mt-1 text-xs text-neutral-500">
          Saved from underspending, reserved for other rooms.
        </p>
      </section>
    </main>
  );
}

function CartLineRow({ item }: { item: AdjustedBudget }) {
  const line = item.cart;
  if (!line) {
    return null;
  }
  return (
    <li className="py-3 text-sm text-neutral-800">
      <p className="font-medium text-neutral-900">{item.name}</p>
      <p className="mt-1">{line.listing.title}</p>
      <p className="mt-1">
        {formatCents(line.listing.priceCents)} × {line.quantity}
        {line.discountCents > 0 ? `, minus ${formatCents(line.discountCents)} once` : ""}
      </p>
      {line.discountCents > 0 ? (
        <p>Merchant promotion applied: −{formatCents(line.discountCents)}</p>
      ) : null}
      <p>
        {formatCents(line.shippingCents)}. {line.shippingLabel}
      </p>
      <p className="mt-1">Line total {formatCents(line.totalCents)}</p>
    </li>
  );
}
