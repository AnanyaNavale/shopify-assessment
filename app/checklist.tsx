"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { formatCents, type ChecklistItem, type ChecklistTier, type Listing } from "@/lib/catalog";
import { getChartModel, type BudgetRange } from "@/lib/market";
import { buildAdjustedBudget, type ItemPreference } from "@/lib/plan";
import type { UnderspendChoice } from "@/lib/underspend";
import type { AdjustedBudget } from "@/lib/rebalance";

export function BudgetPanel({
  tiers,
  items,
  order,
  quantities,
  enabled,
  preferences,
  postalCode,
  cart,
  choices,
  onOrderChange,
  onQuantityChange,
  onEnabledChange,
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
  onOrderChange: (tierId: number, itemIds: string[]) => void;
  onQuantityChange: (itemId: string, quantity: number) => void;
  onEnabledChange: (itemId: string, on: boolean) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const itemsById = new Map(items.map((item) => [item.id, item]));
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
  });
  const adjustmentOf = new Map(adjusted.items.map((item) => [item.id, item]));
  const over = adjusted.overByCents > 0;

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }
    const activeId = String(active.id);
    const overId = String(over.id);
    const tierId = itemsById.get(activeId)?.tierId;
    const overTierId = itemsById.get(overId)?.tierId;
    if (tierId === undefined || tierId !== overTierId) {
      return;
    }
    const list = order[tierId] ?? [];
    const oldIndex = list.indexOf(activeId);
    const newIndex = list.indexOf(overId);
    if (oldIndex < 0 || newIndex < 0) {
      return;
    }
    onOrderChange(tierId, arrayMove(list, oldIndex, newIndex));
  }

  return (
    <>
      <section className="rounded-lg border border-neutral-200 bg-white p-5">
        <h2 className="text-sm font-medium text-neutral-900">Budget checklist</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Top of a tier is the higher priority. Shipping is included once per item.
        </p>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <div className="mt-4 grid gap-4">
            {tiers.map((tier) => {
              const ids = order[tier.id] ?? [];
              return (
                <div key={tier.id}>
                  <h3 className="text-xs font-medium tracking-wide text-neutral-500 uppercase">
                    Tier {tier.id} — {tier.name}
                  </h3>
                  <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                    <ul className="mt-2 grid gap-2">
                      {ids.map((id) => {
                        const item = itemsById.get(id);
                        if (!item) {
                          return null;
                        }
                        return (
                          <ChecklistRow
                            key={item.id}
                            item={item}
                            quantity={quantities[item.id] ?? 0}
                            on={enabled[item.id] ?? false}
                            adjustment={adjustmentOf.get(item.id)}
                            rangeNote={rangeNote(
                              item,
                              quantities[item.id] ?? 0,
                              preferences[item.id],
                              postalCode,
                            )}
                            onQuantityChange={onQuantityChange}
                            onEnabledChange={onEnabledChange}
                          />
                        );
                      })}
                    </ul>
                  </SortableContext>
                </div>
              );
            })}
          </div>
        </DndContext>
      </section>
      <section className="rounded-lg border border-neutral-200 bg-white p-5">
        <h2 className="text-sm font-medium text-neutral-900">Room total</h2>
        <p className={`mt-3 text-sm ${over ? "font-medium text-red-700" : "text-neutral-800"}`}>
          {adjusted.roomLabel !== adjusted.originalRoomLabel ? (
            <>
              <span className="mr-2 text-neutral-400 line-through">
                {adjusted.originalRoomLabel}
              </span>
              {adjusted.roomLabel}
            </>
          ) : (
            adjusted.roomLabel
          )}
        </p>
        {adjusted.tradeoff ? (
          <p className="mt-2 text-sm leading-6 text-neutral-700">{adjusted.tradeoff}</p>
        ) : null}
        <p className="mt-1 text-xs text-neutral-500">
          Sum of the items that are on, including each shipping allowance.
          {over ? " This total is over the room budget." : ""}
        </p>
      </section>
    </>
  );
}

function itemRanges(
  item: ChecklistItem,
  quantity: number,
  preference: ItemPreference | undefined,
  postalCode: string,
): BudgetRange[] {
  return getChartModel(
    item.id,
    {
      postalCode,
      material: preference?.material.trim() || undefined,
      color: preference?.color.trim() || undefined,
    },
    quantity,
  ).ranges;
}

function rangeNote(
  item: ChecklistItem,
  quantity: number,
  preference: ItemPreference | undefined,
  postalCode: string,
): string {
  if (quantity <= 0) {
    return "Quantity is 0, so this item adds nothing.";
  }
  return itemRanges(item, quantity, preference, postalCode)
    .map((range) => `${range.perUnitLabel} × ${quantity}, plus shipping.`)
    .join(" ");
}

function ChecklistRow({
  item,
  quantity,
  on,
  adjustment,
  rangeNote: note,
  onQuantityChange,
  onEnabledChange,
}: {
  item: ChecklistItem;
  quantity: number;
  on: boolean;
  adjustment: AdjustedBudget | undefined;
  rangeNote: string;
  onQuantityChange: (itemId: string, quantity: number) => void;
  onEnabledChange: (itemId: string, on: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: item.id,
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`rounded-md border border-neutral-200 p-2 ${on ? "" : "opacity-50"}`}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="cursor-grab px-1 text-xs text-neutral-400"
          aria-label={`Reorder ${item.name}`}
          {...attributes}
          {...listeners}
        >
          Drag
        </button>
        <label className="flex min-w-0 flex-1 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={on}
            onChange={(event) => onEnabledChange(item.id, event.target.checked)}
            aria-label={`Include ${item.name}`}
          />
          <span className="font-medium text-neutral-900">{item.name}</span>
        </label>
      </div>
      <label className="mt-2 flex items-center gap-2 text-xs text-neutral-600">
        Qty
        <input
          type="number"
          min={0}
          value={quantity}
          onChange={(event) => {
            const next = Number.parseInt(event.target.value, 10);
            onQuantityChange(item.id, Number.isNaN(next) ? 0 : Math.max(0, next));
          }}
          aria-label={`${item.name} quantity`}
          className="w-14 rounded border border-neutral-300 px-1 py-0.5 text-sm text-neutral-900"
        />
        {item.quantityNote ? <span>{item.quantityNote}</span> : null}
      </label>
      <BudgetLine on={on} note={note} adjustment={adjustment} />
    </li>
  );
}

function BudgetLine({
  on,
  note,
  adjustment,
}: {
  on: boolean;
  note: string;
  adjustment: AdjustedBudget | undefined;
}) {
  if (!adjustment) {
    return null;
  }
  if (!on) {
    return (
      <p className="mt-1 text-xs text-neutral-700">
        Off · {adjustment.originalLabel}. {note}
      </p>
    );
  }
  if (adjustment.cut) {
    return (
      <p className="mt-1 text-xs text-neutral-700">
        <span className="text-neutral-400 line-through">{adjustment.originalLabel}</span> Cut
      </p>
    );
  }
  const showCart = adjustment.comparison === "over" && adjustment.cart;
  return (
    <div className="mt-1 grid gap-1 text-xs text-neutral-700">
      <p>
        {adjustment.slashed ? (
          <>
            <span className="mr-1 text-neutral-400 line-through">{adjustment.originalLabel}</span>
            {showCart ? formatCents(adjustment.cart?.totalCents ?? 0) : adjustment.currentLabel}
          </>
        ) : (
          adjustment.originalLabel
        )}
        {showCart ? null : `. ${note}`}
      </p>
      {adjustment.cart ? (
        <CartNote comparison={adjustment.comparison} cart={adjustment.cart} />
      ) : null}
      {adjustment.underspendNote ? <p>{adjustment.underspendNote}</p> : null}
    </div>
  );
}

function CartNote({
  cart,
  comparison,
}: {
  cart: NonNullable<AdjustedBudget["cart"]>;
  comparison: AdjustedBudget["comparison"];
}) {
  const price = formatCents(cart.listing.priceCents);
  const shipping = formatCents(cart.shippingCents);
  const estimate = formatCents(cart.totalCents);
  return (
    <div>
      <p>
        Cart estimate {estimate}. {price} × {cart.quantity}
        {cart.discountCents > 0
          ? `, minus ${formatCents(cart.discountCents)} once`
          : ""}
        , plus {shipping} shipping.
      </p>
      {cart.discountCents > 0 ? (
        <p>Merchant promotion applied: −{formatCents(cart.discountCents)}</p>
      ) : null}
      {comparison === "under" ? <p>This cart is under the budgeted range.</p> : null}
      {comparison === "within" ? <p>This is within the budgeted range.</p> : null}
    </div>
  );
}
