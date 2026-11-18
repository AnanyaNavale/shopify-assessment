"use client";

import { useEffect, useRef } from "react";
import { formatCents } from "@/lib/catalog";
import type { AdjustedBudget } from "@/lib/rebalance";

export function UnderspendDialog({
  item,
  recipient,
  onMove,
  onSave,
  onDismiss,
}: {
  item: AdjustedBudget;
  recipient: AdjustedBudget | null;
  onMove: () => void;
  onSave: () => void;
  onDismiss: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const surplus = Math.max(0, item.originalMinCents - (item.cart?.totalCents ?? 0));
  const amount = formatCents(surplus);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      onCancel={(event) => {
        event.preventDefault();
        onDismiss();
      }}
      aria-labelledby="underspend-title"
      className="w-full max-w-md rounded-lg p-5 backdrop:bg-black/40"
    >
      <h2 id="underspend-title" className="text-base font-medium text-neutral-900">
        Under the budgeted range
      </h2>
      <p className="mt-3 text-sm leading-6 text-neutral-800">
        This {item.name.toLowerCase()} is {amount} under the budgeted range.
      </p>
      <div className="mt-4 flex flex-col gap-2">
        {recipient ? (
          <button
            type="button"
            onClick={onMove}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm text-white"
          >
            Add {amount} to {recipient.name.toLowerCase()}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onSave}
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm text-neutral-900"
        >
          Save {amount} to the house fund
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="px-4 py-2 text-sm text-neutral-500"
        >
          Not now
        </button>
      </div>
    </dialog>
  );
}
