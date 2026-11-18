import { writeFile } from "node:fs/promises";

const CATALOG_URL = "https://catalog.shopify.com/api/ucp/mcp";
const PROFILE =
  "https://shopify.dev/ucp/agent-profiles/examples/2026-08-25/valid-with-capabilities.json";

const BANDS = [
  { minCents: 20000, maxCents: 49999 },
  { minCents: 50000, maxCents: 99999 },
  { minCents: 100000, maxCents: 179999 },
  { minCents: 180000, maxCents: 299999 },
  { minCents: 300000, maxCents: null },
];

const GENERAL_QUERY = "couch";
const FILTERED_QUERY = "couch";
const LIMIT = 12;

function priceFilter(band) {
  const price = { min: band.minCents };
  if (band.maxCents !== null) {
    price.max = band.maxCents;
  }
  return price;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function searchCatalog(id, catalog) {
  let response = null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    response = await fetch(CATALOG_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "tools/call",
        id,
        params: {
          name: "search_catalog",
          arguments: {
            meta: { "ucp-agent": { profile: PROFILE } },
            catalog,
          },
        },
      }),
    });
    if (response.status !== 429) {
      break;
    }
    await wait(1500 * (attempt + 1));
  }
  if (!response?.ok) {
    throw new Error(`Catalog HTTP ${response?.status}`);
  }
  const body = await response.json();
  if (body.error) {
    throw new Error(body.error.message ?? "Catalog JSON-RPC error");
  }
  const content = body.result?.structuredContent;
  if (!content?.pagination || !Array.isArray(content.products)) {
    throw new Error("Catalog response did not include products and pagination.");
  }
  return content;
}

function toListing(product, bandIndex, matchesPreference) {
  const variant = product.variants?.[0];
  const amount = variant?.price?.amount ?? product.price_range?.min?.amount;
  if (typeof amount !== "number") {
    return null;
  }
  const listAmount = variant?.list_price?.amount;
  return {
    id: product.id,
    itemId: "couch",
    bandIndex,
    title: product.title,
    url: variant?.url ?? product.url ?? "",
    priceCents: amount,
    listPriceCents: typeof listAmount === "number" ? listAmount : null,
    imageUrl: product.media?.[0]?.url ?? "/listing-placeholder.svg",
    runningLow: variant?.availability?.running_low === true,
    rating: typeof product.rating?.value === "number" ? product.rating.value : null,
    sellerName: variant?.seller?.name ?? "Seller",
    matchesPreference,
    automaticPromotion: null,
  };
}

const bands = [];
const listings = [];
let requestId = 1;

for (let index = 0; index < BANDS.length; index += 1) {
  const band = BANDS[index];
  const general = await searchCatalog(requestId, {
    query: GENERAL_QUERY,
    filters: {
      price: priceFilter(band),
      ships_to: { country: "US" },
    },
    pagination: { limit: LIMIT },
  });
  requestId += 1;
  const filtered = await searchCatalog(requestId, {
    query: FILTERED_QUERY,
    filters: {
      price: priceFilter(band),
      ships_to: { country: "US" },
      attributes: [{ name: "Color", values: ["Blue"] }],
    },
    pagination: { limit: LIMIT },
  });
  requestId += 1;

  bands.push({
    minCents: band.minCents,
    maxCents: band.maxCents,
    generalCount: general.pagination.total_count,
    filteredCount: filtered.pagination.total_count,
  });

  const seen = new Set();
  for (const product of filtered.products) {
    const listing = toListing(product, index, true);
    if (!listing || seen.has(listing.id)) {
      continue;
    }
    seen.add(listing.id);
    listings.push(listing);
  }
  for (const product of general.products) {
    const listing = toListing(product, index, false);
    if (!listing || seen.has(listing.id)) {
      continue;
    }
    seen.add(listing.id);
    listings.push(listing);
  }
  console.log(
    `band ${index}: general ${general.pagination.total_count}, filtered ${filtered.pagination.total_count}, listings ${seen.size}`,
  );
  await wait(800);
}

const snapshot = {
  source: "catalog",
  fetchedAt: new Date().toISOString(),
  endpoint: CATALOG_URL,
  profile: PROFILE,
  generalQuery: GENERAL_QUERY,
  filteredQuery: FILTERED_QUERY,
  color: "blue",
  shipsTo: { country: "US" },
  note: "Saved Catalog search for the couch. Postal code does not re-query this file. Other checklist items, shipping, cart, and checkout stay mock. Catalog did not return an automatic promotion.",
  bands,
  listings,
};

await writeFile(new URL("../data/live-couch.json", import.meta.url), `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(`wrote ${listings.length} couch listings`);
