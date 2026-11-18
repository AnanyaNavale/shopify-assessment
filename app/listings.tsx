"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  formatCents,
  getListings,
  type CatalogContext,
  type Listing,
} from "@/lib/catalog";

export function ListingsSection({
  itemId,
  bandIndex,
  bandLabel,
  context,
  selectedListingId,
  onSelectListing,
}: {
  itemId: string;
  bandIndex: number | null;
  bandLabel: string | null;
  context: CatalogContext;
  selectedListingId: string | null;
  onSelectListing: (listing: Listing | null) => void;
}) {
  const [openListing, setOpenListing] = useState<Listing | null>(null);

  if (bandIndex === null || bandLabel === null) {
    return (
      <section className="rounded-lg border border-neutral-200 bg-white p-5">
        <h2 className="text-sm font-medium text-neutral-900">Listings</h2>
        <p className="mt-4 text-sm text-neutral-600">Click a price band to see listings.</p>
      </section>
    );
  }

  const groups = getListings(itemId, bandIndex, context);
  const none = groups.preferred.length === 0 && groups.others.length === 0;

  function toggle(listing: Listing) {
    onSelectListing(selectedListingId === listing.id ? null : listing);
  }

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5">
      <h2 className="text-sm font-medium text-neutral-900">Listings · {bandLabel}</h2>
      {none ? (
        <p className="mt-4 text-sm text-neutral-600">
          No saved listings for this band.
        </p>
      ) : (
        <div className="mt-4 grid gap-6">
          <ListingGroup
            title="Closest to your preferences"
            listings={groups.preferred}
            emptyText="No preference matches in this band."
            selectedListingId={selectedListingId}
            onToggle={toggle}
            onOpen={setOpenListing}
          />
          <ListingGroup
            title="Others in this price band"
            listings={groups.others}
            emptyText="None."
            selectedListingId={selectedListingId}
            onToggle={toggle}
            onOpen={setOpenListing}
          />
        </div>
      )}
      {openListing ? (
        <ListingDialog listing={openListing} onClose={() => setOpenListing(null)} />
      ) : null}
    </section>
  );
}

function ListingGroup({
  title,
  listings,
  emptyText,
  selectedListingId,
  onToggle,
  onOpen,
}: {
  title: string;
  listings: Listing[];
  emptyText: string;
  selectedListingId: string | null;
  onToggle: (listing: Listing) => void;
  onOpen: (listing: Listing) => void;
}) {
  return (
    <div>
      <h3 className="text-sm font-medium text-neutral-900">{title}</h3>
      {listings.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-600">{emptyText}</p>
      ) : (
        <ul className="mt-2 divide-y divide-neutral-200">
          {listings.map((listing) => (
            <ListingRow
              key={listing.id}
              listing={listing}
              checked={listing.id === selectedListingId}
              onToggle={onToggle}
              onOpen={onOpen}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function ListingRow({
  listing,
  checked,
  onToggle,
  onOpen,
}: {
  listing: Listing;
  checked: boolean;
  onToggle: (listing: Listing) => void;
  onOpen: (listing: Listing) => void;
}) {
  const onSale = listing.listPriceCents !== null && listing.listPriceCents > listing.priceCents;

  return (
    <li className="flex items-center gap-3 py-3">
      <input
        type="checkbox"
        checked={checked}
        aria-label={`Select ${listing.title}`}
        onChange={() => onToggle(listing)}
        className="h-4 w-4"
      />
      <button
        type="button"
        onClick={() => onOpen(listing)}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <Image
          src={listing.imageUrl}
          alt=""
          width={56}
          height={56}
          unoptimized
          className="h-14 w-14 shrink-0 rounded bg-neutral-100 object-cover"
        />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-neutral-900">{listing.title}</span>
          <span className="block text-sm text-neutral-800">{formatCents(listing.priceCents)}</span>
          <span className="block text-xs text-neutral-500">
            {listing.sellerName}
            {listing.rating === null ? "" : ` · ${listing.rating.toFixed(1)}`}
          </span>
        </span>
        <span className="flex shrink-0 gap-1">
          {onSale ? (
            <span className="rounded bg-neutral-900 px-1.5 py-0.5 text-[10px] font-medium text-white">
              Sale
            </span>
          ) : null}
          {listing.runningLow ? (
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-900">
              Running low
            </span>
          ) : null}
        </span>
      </button>
    </li>
  );
}

function ListingDialog({ listing, onClose }: { listing: Listing; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const onSale = listing.listPriceCents !== null && listing.listPriceCents > listing.priceCents;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) {
      return;
    }
    dialog.showModal();
    return () => {
      dialog.close();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="listing-title"
      className="w-full max-w-md rounded-lg p-5 backdrop:bg-black/40"
    >
      <Image
        src={listing.imageUrl}
        alt=""
        width={96}
        height={96}
        unoptimized
        className="h-24 w-24 rounded bg-neutral-100"
      />
      <h3 id="listing-title" className="mt-3 text-base font-medium text-neutral-900">
        {listing.title}
      </h3>
      <p className="mt-3 text-sm text-neutral-800">Seller {listing.sellerName}</p>
      {listing.rating === null ? null : (
        <p className="mt-1 text-sm text-neutral-800">Rating {listing.rating.toFixed(1)}</p>
      )}
      <p className="mt-1 text-sm text-neutral-800">
        {onSale ? (
          <>
            <span className="mr-2 text-neutral-400 line-through">
              {formatCents(listing.listPriceCents as number)}
            </span>
            {formatCents(listing.priceCents)}
          </>
        ) : (
          formatCents(listing.priceCents)
        )}
      </p>
      {listing.runningLow ? <p className="mt-1 text-sm text-neutral-800">Running low</p> : null}
      <p className="mt-3 break-all text-xs text-neutral-500">{listing.url}</p>
      <button
        type="button"
        onClick={onClose}
        className="mt-4 rounded-md bg-neutral-900 px-4 py-2 text-sm text-white"
      >
        Close
      </button>
    </dialog>
  );
}
