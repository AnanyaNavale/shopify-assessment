"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DraggableAttributes,
  type DraggableSyntheticListeners,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  formatCents,
  getShippingAllowance,
  type ChecklistItem,
  type ChecklistTier,
  type Listing,
} from "@/lib/catalog";
import { getChartModel, type BudgetRange } from "@/lib/market";
import { buildAdjustedBudget, type AcceptedBudget, type ItemPreference } from "@/lib/plan";
import type { UnderspendChoice } from "@/lib/underspend";
import { roomTotalIncreased, type AdjustedBudget } from "@/lib/rebalance";

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
  accepted,
  onSetBudget,
  onOrderChange,
  onQuantityChange,
  onEnabledChange,
  selectedItemId,
  onSelectItem,
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
  onSetBudget: () => void;
  onOrderChange: (tierId: number, itemIds: string[]) => void;
  onQuantityChange: (itemId: string, quantity: number) => void;
  onEnabledChange: (itemId: string, on: boolean) => void;
  selectedItemId: string;
  onSelectItem: (itemId: string) => void;
}) {
  const [dragReady, setDragReady] = useState(false);
  useEffect(() => {
    setDragReady(true);
  }, []);
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
    accepted,
  });
  const adjustmentOf = new Map(adjusted.items.map((item) => [item.id, item]));
  const roomRaised = roomTotalIncreased(adjusted.items);
  const assignedTotal = adjusted.items.reduce((sum, item) => {
    if (!item.enabled || !item.cart || item.cart.quantity <= 0) {
      return sum;
    }
    return sum + item.cart.totalCents;
  }, 0);

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
      <section>
        <h2 className="text-base font-semibold text-neutral-900">Budget checklist</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Choose the items to add. Top of a tier is the higher priority. Shipping is included once
          per item.
        </p>
        <ItemMenu tiers={tiers} items={items} enabled={enabled} onEnabledChange={onEnabledChange} />
        {items.some((item) => enabled[item.id]) ? (
          dragReady ? (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <TierLists
                tiers={tiers}
                order={order}
                itemsById={itemsById}
                quantities={quantities}
                enabled={enabled}
                preferences={preferences}
                postalCode={postalCode}
                adjustmentOf={adjustmentOf}
                onQuantityChange={onQuantityChange}
                onEnabledChange={onEnabledChange}
                selectedItemId={selectedItemId}
                onSelectItem={onSelectItem}
                sortable
              />
            </DndContext>
          ) : (
            <TierLists
              tiers={tiers}
              order={order}
              itemsById={itemsById}
              quantities={quantities}
              enabled={enabled}
              preferences={preferences}
              postalCode={postalCode}
              adjustmentOf={adjustmentOf}
              onQuantityChange={onQuantityChange}
              onEnabledChange={onEnabledChange}
              selectedItemId={selectedItemId}
              onSelectItem={onSelectItem}
              sortable={false}
            />
          )
        ) : (
          <p className="mt-4 text-sm text-neutral-600">No items on the checklist yet.</p>
        )}
      </section>
      <hr className="border-neutral-200" />
      <section>
        <h2 className="text-base font-semibold text-neutral-900">Room total</h2>
        <div className="mt-1 flex items-center justify-between gap-3">
          <p className="min-w-0 text-sm text-neutral-800">
            {adjusted.roomLabel !== adjusted.originalRoomLabel ? (
              <>
                <span className="mr-2 text-neutral-400 line-through">
                  {adjusted.originalRoomLabel}
                </span>
                <span className={roomRaised ? "font-medium text-red-700" : undefined}>{adjusted.roomLabel}</span>
              </>
            ) : (
              adjusted.roomLabel
            )}
          </p>
          <p className="shrink-0 pr-2 text-base font-medium leading-tight text-neutral-900">
            {formatCents(assignedTotal)}
          </p>
        </div>
        {adjusted.tradeoff ? (
          <>
            <p className="mt-2 text-sm text-neutral-700">{adjusted.tradeoff}</p>
            <button
              type="button"
              onClick={onSetBudget}
              className="mt-3 cursor-pointer rounded-full bg-neutral-900 px-4 py-2 text-sm text-white"
            >
              Set as new budget
            </button>
          </>
        ) : null}
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
      material: preference?.material?.trim() || undefined,
      color: preference?.color.trim() || undefined,
    },
    quantity,
  ).ranges;
}

function quantityRangeLabel(range: BudgetRange): string {
  const minCents = range.totalMinCents - range.shippingCents;
  if (range.totalMaxCents === null) {
    return `${formatCents(minCents)}+`;
  }
  return `${formatCents(minCents)}–${formatCents(range.totalMaxCents - range.shippingCents)}`;
}

function rangeNote(
  item: ChecklistItem,
  quantity: number,
  preference: ItemPreference | undefined,
  postalCode: string,
  listingSelected: boolean,
): string {
  if (quantity <= 0) {
    return "Quantity is 0, so this item adds nothing.";
  }
  return itemRanges(item, quantity, preference, postalCode)
    .map((range) => {
      const label = quantityRangeLabel(range);
      if (listingSelected) {
        return label;
      }
      return `${label}, plus ${formatCents(range.shippingCents)} shipping.`;
    })
    .join(" ");
}

function ItemMenu({
  tiers,
  items,
  enabled,
  onEnabledChange,
}: {
  tiers: ChecklistTier[];
  items: ChecklistItem[];
  enabled: Record<string, boolean>;
  onEnabledChange: (itemId: string, on: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const selectedCount = items.filter((item) => enabled[item.id]).length;

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
    <div ref={menuRef} className="relative mt-3">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full cursor-pointer items-center justify-between rounded-full border border-neutral-300 bg-white px-3 py-2 text-left text-sm text-neutral-900"
      >
        <span>Items to purchase</span>
        <span className="flex items-center gap-1 text-xs text-neutral-500">
          ({selectedCount})
          <svg viewBox="0 0 16 16" aria-hidden="true" className="h-3.5 w-3.5">
            {open ? (
              <path d="M3.5 10.5 L8 6 L12.5 10.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            ) : (
              <path d="M3.5 6 L8 10.5 L12.5 6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            )}
          </svg>
        </span>
      </button>
      {open ? (
        <div className="absolute z-20 mt-1 max-h-80 w-full overflow-y-auto rounded-lg border border-neutral-200 bg-white p-2 shadow-lg">
          {tiers.map((tier) => (
            <div key={tier.id} className="py-1">
              <p className="px-2 py-1 text-xs font-medium text-neutral-500">
                Tier {tier.id} — {tier.name}
              </p>
              {items
                .filter((item) => item.tierId === tier.id)
                .map((item) => (
                  <label
                    key={item.id}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm text-neutral-900 hover:bg-neutral-50 [&_input]:cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={enabled[item.id] ?? false}
                      onChange={(event) => onEnabledChange(item.id, event.target.checked)}
                    />
                    {item.name}
                  </label>
                ))}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function TierLists({
  tiers,
  order,
  itemsById,
  quantities,
  enabled,
  preferences,
  postalCode,
  adjustmentOf,
  onQuantityChange,
  onEnabledChange,
  selectedItemId,
  onSelectItem,
  sortable,
}: {
  tiers: ChecklistTier[];
  order: Record<number, string[]>;
  itemsById: Map<string, ChecklistItem>;
  quantities: Record<string, number>;
  enabled: Record<string, boolean>;
  preferences: Record<string, ItemPreference>;
  postalCode: string;
  adjustmentOf: Map<string, AdjustedBudget>;
  onQuantityChange: (itemId: string, quantity: number) => void;
  onEnabledChange: (itemId: string, on: boolean) => void;
  selectedItemId: string;
  onSelectItem: (itemId: string) => void;
  sortable: boolean;
}) {
  return (
    <div className="mt-4 grid gap-4">
      {tiers.map((tier) => {
        const ids = (order[tier.id] ?? []).filter((id) => enabled[id]);
        if (ids.length === 0) {
          return null;
        }
        const rows = ids.map((id) => {
          const item = itemsById.get(id);
          if (!item) {
            return null;
          }
          const rowProps = {
            item,
            quantity: quantities[item.id] ?? 0,
            on: enabled[item.id] ?? false,
            adjustment: adjustmentOf.get(item.id),
            rangeNote: rangeNote(
              item,
              quantities[item.id] ?? 0,
              preferences[item.id],
              postalCode,
              adjustmentOf.get(item.id)?.cart != null,
            ),
            onQuantityChange,
            onEnabledChange,
            selected: item.id === selectedItemId,
            onSelect: () => onSelectItem(item.id),
          };
          return sortable ? (
            <ChecklistRow key={item.id} {...rowProps} />
          ) : (
            <ChecklistRowBody key={item.id} {...rowProps} />
          );
        });
        return (
          <div key={tier.id}>
            <h3 className="text-sm font-semibold tracking-wide text-neutral-500 uppercase">
              Tier {tier.id} — {tier.name}
            </h3>
            {sortable ? (
              <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                <ul className="mt-2 grid gap-2">{rows}</ul>
              </SortableContext>
            ) : (
              <ul className="mt-2 grid gap-2">{rows}</ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

type ChecklistRowProps = {
  item: ChecklistItem;
  quantity: number;
  on: boolean;
  adjustment: AdjustedBudget | undefined;
  rangeNote: string;
  onQuantityChange: (itemId: string, quantity: number) => void;
  onEnabledChange: (itemId: string, on: boolean) => void;
  selected: boolean;
  onSelect: () => void;
};

function ChecklistRow(props: ChecklistRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: props.item.id,
  });

  return (
    <ChecklistRowBody
      {...props}
      setNodeRef={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      dragAttributes={attributes}
      dragListeners={listeners}
    />
  );
}

function ChecklistRowBody({
  item,
  quantity,
  on,
  adjustment,
  rangeNote: note,
  onQuantityChange,
  onEnabledChange,
  selected,
  onSelect,
  setNodeRef,
  style,
  dragAttributes,
  dragListeners,
}: ChecklistRowProps & {
  setNodeRef?: (element: HTMLElement | null) => void;
  style?: { transform?: string; transition?: string };
  dragAttributes?: DraggableAttributes;
  dragListeners?: DraggableSyntheticListeners;
}) {
  return (
    <li
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      aria-current={selected ? "true" : undefined}
      className={`checklist-card cursor-pointer rounded-md border p-2 transition-colors ${
        selected
          ? "border-neutral-900 bg-neutral-50 hover:bg-neutral-100"
          : "border-neutral-200 bg-white hover:border-neutral-400 hover:bg-neutral-50"
      } ${on ? "" : "opacity-50"}`}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="drag-handle px-1 text-xs text-neutral-400"
              aria-label={`Reorder ${item.name}`}
              {...dragAttributes}
              {...dragListeners}
              style={{ cursor: "grab" }}
            >
              <svg viewBox="0 0 16 16" aria-hidden="true" className="drag-handle h-4 w-4" style={{ cursor: "grab" }}>
                <circle cx="5" cy="3" r="1.2" fill="currentColor" />
                <circle cx="11" cy="3" r="1.2" fill="currentColor" />
                <circle cx="5" cy="8" r="1.2" fill="currentColor" />
                <circle cx="11" cy="8" r="1.2" fill="currentColor" />
                <circle cx="5" cy="13" r="1.2" fill="currentColor" />
                <circle cx="11" cy="13" r="1.2" fill="currentColor" />
              </svg>
            </button>
            <input
              type="checkbox"
              checked={on}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => onEnabledChange(item.id, event.target.checked)}
              aria-label={`Include ${item.name}`}
            />
            <span className="min-w-0 flex-1 text-sm font-medium text-neutral-900">{item.name}</span>
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
              className="qty-input w-14 rounded border border-neutral-300 px-1 py-0.5 text-sm text-neutral-900"
            />
            {item.quantityNote ? <span>{item.quantityNote}</span> : null}
          </label>
          <BudgetLine on={on} note={note} adjustment={adjustment} />
        </div>
        {adjustment?.cart ? (
          <div className="flex shrink-0 flex-col items-center">
            <Image
              src={adjustment.cart.listing.imageUrl}
              alt=""
              width={64}
              height={64}
              unoptimized
              className="h-16 w-16 rounded border border-neutral-200 bg-neutral-100 object-cover"
            />
            <p className="mt-1 text-center text-base font-medium leading-tight text-neutral-900">
              {formatCents(adjustment.cart.listing.priceCents * adjustment.cart.quantity)}
            </p>
          </div>
        ) : (
          <div
            aria-hidden="true"
            className="h-16 w-16 shrink-0 rounded border border-dotted border-neutral-300 bg-neutral-50"
          />
        )}
      </div>
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
        Off · {note}
      </p>
    );
  }
  if (adjustment.cut) {
    return (
      <p className="mt-1 text-xs text-neutral-700">
        <span className="text-neutral-400 line-through">{note}</span> Cut
      </p>
    );
  }
  const showCart = adjustment.comparison === "over" && adjustment.cart;
  return (
    <div className="mt-1 grid gap-1 text-xs text-neutral-700">
      {adjustment.slashed ? (
        <>
          <p className="text-neutral-400 line-through">{rangeText(adjustment, "original", false)}</p>
          <p className={`whitespace-nowrap ${budgetRaised(adjustment) ? "font-medium text-red-700" : ""}`}>
            {showCart ? formatCents(adjustment.cart?.totalCents ?? 0) : rangeText(adjustment, "current", !adjustment.cart)}
          </p>
        </>
      ) : (
        <p>
          {note.startsWith("Quantity is 0")
            ? note
            : showCart
              ? formatCents(adjustment.cart?.totalCents ?? 0)
              : rangeText(adjustment, "current", !adjustment.cart)}
        </p>
      )}
      {adjustment.cart ? (
        <CartNote comparison={adjustment.comparison} cart={adjustment.cart} />
      ) : null}
      {adjustment.underspendNote ? <p>{adjustment.underspendNote}</p> : null}
    </div>
  );
}

function budgetRaised(adjustment: AdjustedBudget): boolean {
  if (adjustment.comparison === "over" && adjustment.cart && adjustment.originalMaxCents !== null) {
    return adjustment.cart.totalCents > adjustment.originalMaxCents;
  }
  if (adjustment.currentMaxCents === null) {
    return adjustment.originalMaxCents !== null;
  }
  if (adjustment.originalMaxCents === null) {
    return adjustment.currentMinCents > adjustment.originalMinCents;
  }
  return (
    adjustment.currentMaxCents > adjustment.originalMaxCents ||
    adjustment.currentMinCents > adjustment.originalMinCents
  );
}

function rangeText(
  adjustment: AdjustedBudget,
  field: "original" | "current",
  withShipping: boolean,
): string {
  const shipping = getShippingAllowance(adjustment.id).amountCents;
  const rawMin = field === "original" ? adjustment.originalMinCents : adjustment.currentMinCents;
  const rawMax = field === "original" ? adjustment.originalMaxCents : adjustment.currentMaxCents;
  if (rawMin === 0 && (rawMax === 0 || rawMax === null)) {
    return formatCents(0);
  }
  const minCents = Math.max(0, rawMin - shipping);
  const maxCents = rawMax === null ? null : Math.max(0, rawMax - shipping);
  const label =
    maxCents === null
      ? `${formatCents(minCents)}+`
      : minCents === maxCents
        ? formatCents(minCents)
        : `${formatCents(minCents)}–${formatCents(maxCents)}`;
  if (!withShipping) {
    return label;
  }
  return `${label}, plus ${formatCents(shipping)} shipping.`;
}

function CartNote({
  cart,
  comparison,
}: {
  cart: NonNullable<AdjustedBudget["cart"]>;
  comparison: AdjustedBudget["comparison"];
}) {
  const price = formatCents(cart.listing.priceCents * cart.quantity);
  const shipping = formatCents(cart.shippingCents);
  return (
    <div>
      <p>
        {price}
        {cart.discountCents > 0 ? `, minus ${formatCents(cart.discountCents)} once` : ""}
        , plus {shipping} shipping.
      </p>
      {cart.discountCents > 0 ? (
        <p>Merchant promotion applied: −{formatCents(cart.discountCents)}</p>
      ) : null}
      {comparison === "within" ? <p>This is within the budgeted range.</p> : null}
    </div>
  );
}
