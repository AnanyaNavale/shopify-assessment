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
  selectedListing,
  onSelectListing,
}: {
  itemId: string;
  bandIndex: number | null;
  bandLabel: string | null;
  context: CatalogContext;
  selectedListing: Listing | null;
  onSelectListing: (listing: Listing | null) => void;
}) {
  const [openListing, setOpenListing] = useState<Listing | null>(null);

  if (!itemId) {
    return (
      <section className="rounded-lg border border-neutral-200 bg-white p-5">
        <h2 className="text-base font-semibold text-neutral-900">Listings</h2>
        <p className="mt-4 text-sm text-neutral-600">
          Add an item to your checklist on the left, then select it to see listings.
        </p>
      </section>
    );
  }

  if (bandIndex === null || bandLabel === null) {
    return (
      <section className="rounded-lg border border-neutral-200 bg-white p-5">
        <h2 className="text-base font-semibold text-neutral-900">Listings</h2>
        <p className="mt-4 text-sm text-neutral-600">Click a price band to see listings.</p>
      </section>
    );
  }

  const groups = getListings(itemId, bandIndex, context);
  const hasColor = Boolean(context.color?.trim());
  const none = groups.preferred.length === 0 && groups.others.length === 0;

  function isExplicitSelection(listing: Listing) {
    return (
      selectedListing !== null &&
      listing.id === selectedListing.id &&
      listing.bandIndex === selectedListing.bandIndex
    );
  }

  function toggle(listing: Listing) {
    onSelectListing(isExplicitSelection(listing) ? null : listing);
  }

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5">
      <h2 className="text-base font-semibold text-neutral-900">Listings · {bandLabel}</h2>
      {none ? (
        <p className="mt-4 text-sm text-neutral-600">
          No saved listings for this band.
        </p>
      ) : (
        <div className="mt-4 grid gap-6">
          {hasColor ? (
            <ListingGroup
              title="Closest to your preferences"
              listings={groups.preferred}
              emptyText="No preference matches in this band."
              selectedListing={selectedListing}
              onToggle={toggle}
              onOpen={setOpenListing}
            />
          ) : null}
          <ListingGroup
            title={hasColor ? "Others in this price band" : ""}
            listings={groups.others}
            emptyText="None."
            selectedListing={selectedListing}
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

const LISTINGS_PAGE_SIZE = 5;

function sameSelectedListing(listing: Listing, selected: Listing | null) {
  return selected !== null && listing.id === selected.id && listing.bandIndex === selected.bandIndex;
}

function ListingGroup({
  title,
  listings,
  emptyText,
  selectedListing,
  onToggle,
  onOpen,
}: {
  title: string;
  listings: Listing[];
  emptyText: string;
  selectedListing: Listing | null;
  onToggle: (listing: Listing) => void;
  onOpen: (listing: Listing) => void;
}) {
  const [page, setPage] = useState(0);
  const selectedHere = listings.some((listing) => sameSelectedListing(listing, selectedListing));
  const ordered = selectedHere
    ? [...listings].sort((a, b) => {
        const aSelected = sameSelectedListing(a, selectedListing);
        const bSelected = sameSelectedListing(b, selectedListing);
        if (aSelected === bSelected) return 0;
        return aSelected ? -1 : 1;
      })
    : listings;
  const listingKey = listings.map((listing) => listing.id).join("|");
  const pageCount = Math.max(1, Math.ceil(ordered.length / LISTINGS_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const start = currentPage * LISTINGS_PAGE_SIZE;
  const visible = ordered.slice(start, start + LISTINGS_PAGE_SIZE);

  useEffect(() => {
    setPage(0);
  }, [listingKey]);

  useEffect(() => {
    if (selectedHere) {
      setPage(0);
    }
  }, [selectedHere]);

  return (
    <div>
      {title ? <h3 className="text-base font-semibold text-neutral-900">{title}</h3> : null}
      {listings.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-600">{emptyText}</p>
      ) : (
        <>
          <ul className="mt-2 divide-y divide-neutral-200">
            {visible.map((listing) => (
              <ListingRow
                key={listing.id}
                listing={listing}
                checked={sameSelectedListing(listing, selectedListing)}
                onToggle={onToggle}
                onOpen={onOpen}
              />
            ))}
          </ul>
          {pageCount > 1 ? (
            <div className="mt-3 flex items-center justify-between text-xs text-neutral-600">
              <span>
                {start + 1}–{start + visible.length} of {listings.length}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={currentPage === 0}
                  onClick={() => setPage(currentPage - 1)}
                  className="cursor-pointer rounded-full border border-neutral-300 px-3 py-1 disabled:cursor-default disabled:text-neutral-300"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={currentPage >= pageCount - 1}
                  onClick={() => setPage(currentPage + 1)}
                  className="cursor-pointer rounded-full border border-neutral-300 px-3 py-1 disabled:cursor-default disabled:text-neutral-300"
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </>
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
    <li className={`flex items-center gap-3 py-3 ${checked ? "rounded-md bg-neutral-100 px-2" : ""}`}>
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
        <span className="flex shrink-0 flex-col items-center gap-1">
          {checked ? <span className="text-[10px] text-neutral-500">Selected</span> : null}
          <Image
            src={listing.imageUrl}
            alt=""
            width={56}
            height={56}
            unoptimized
            className="h-14 w-14 rounded bg-neutral-100 object-cover"
          />
        </span>
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
            <span className="rounded-full bg-neutral-900 px-2 py-0.5 text-[10px] font-medium text-white">
              Sale
            </span>
          ) : null}
          {listing.runningLow ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-900">
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
      className="fixed top-1/2 left-1/2 m-0 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg p-5 outline-none backdrop:bg-black/40"
    >
      <Image
        src={listing.imageUrl}
        alt=""
        width={96}
        height={96}
        unoptimized
        className="h-24 w-24 rounded bg-neutral-100"
      />
      <h3 id="listing-title" className="mt-3 text-lg font-semibold text-neutral-900">
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
        className="mt-4 cursor-pointer rounded-full bg-neutral-900 px-4 py-2 text-sm text-white"
      >
        Close
      </button>
    </dialog>
  );
}
