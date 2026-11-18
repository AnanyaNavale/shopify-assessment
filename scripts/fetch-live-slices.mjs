import { readFile, writeFile } from "node:fs/promises";

const CATALOG_URL = "https://catalog.shopify.com/api/ucp/mcp";
const PROFILE =
  "https://shopify.dev/ucp/agent-profiles/examples/2026-08-25/valid-with-capabilities.json";
const LIMIT = 12;
const SHIPS_TO = { country: "US", region: "CA", postal_code: "94582" };

const SEARCHES = [
  {
    itemId: "couch",
    color: "white",
    query: "couch",
    colorValue: "White",
  },
  {
    itemId: "couch",
    color: "blue",
    query: "couch",
    colorValue: "Blue",
  },
  {
    itemId: "coffee-table",
    color: "brown",
    query: "coffee table",
    colorValue: "Brown",
  },
  {
    itemId: "couch-pillows",
    color: "green",
    query: "throw pillow",
    colorValue: "Green",
  },
  {
    itemId: "chair-pillows",
    color: "green",
    query: "throw pillow",
    colorValue: "Green",
  },
  {
    itemId: "additional-pillows",
    color: "green",
    query: "throw pillow",
    colorValue: "Green",
  },
];

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function priceFilter(band) {
  const price = { min: band.minCents };
  if (band.maxCents !== null) {
    price.max = band.maxCents;
  }
  return price;
}

async function searchCatalog(id, catalog) {
  let response = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
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
    await wait(2000 * (attempt + 1));
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

function toListing(product, itemId, bandIndex) {
  const variant = product.variants?.[0];
  const amount = variant?.price?.amount ?? product.price_range?.min?.amount;
  if (typeof amount !== "number") {
    return null;
  }
  const listAmount = variant?.list_price?.amount;
  return {
    id: product.id,
    itemId,
    bandIndex,
    title: product.title,
    url: variant?.url ?? product.url ?? "",
    priceCents: amount,
    listPriceCents: typeof listAmount === "number" ? listAmount : null,
    imageUrl: product.media?.[0]?.url ?? "/listing-placeholder.svg",
    runningLow: variant?.availability?.running_low === true,
    rating: typeof product.rating?.value === "number" ? product.rating.value : null,
    sellerName: variant?.seller?.name ?? "Seller",
    matchesPreference: true,
    automaticPromotion: null,
  };
}

const bandsFile = JSON.parse(await readFile(new URL("../data/bands.json", import.meta.url), "utf8"));
const bandsByItem = new Map(bandsFile.items.map((item) => [item.itemId, item.bands]));
const slices = [];
let requestId = 1;

for (const search of SEARCHES) {
  const bands = bandsByItem.get(search.itemId);
  if (!bands) {
    throw new Error(`No bands for ${search.itemId}`);
  }
  const savedBands = [];
  const listings = [];
  for (let index = 0; index < bands.length; index += 1) {
    const band = bands[index];
    const filters = {
      price: priceFilter(band),
      ships_to: SHIPS_TO,
    };
    if (search.colorValue) {
      filters.attributes = [{ name: "Color", values: [search.colorValue] }];
    }
    const result = await searchCatalog(requestId, {
      query: search.query,
      filters,
      pagination: { limit: LIMIT },
    });
    requestId += 1;
    savedBands.push({ filteredCount: result.pagination.total_count });
    const seen = new Set();
    for (const product of result.products) {
      const listing = toListing(product, search.itemId, index);
      if (!listing || seen.has(listing.id)) {
        continue;
      }
      seen.add(listing.id);
      listings.push(listing);
    }
    console.log(`${search.query} ${search.colorValue} band ${index}: ${result.pagination.total_count}`);
    await wait(900);
  }
  slices.push({
    itemId: search.itemId,
    color: search.color,
    query: search.query,
    colorValue: search.colorValue,
    bands: savedBands,
    listings,
  });
}

const snapshot = {
  source: "catalog",
  fetchedAt: new Date().toISOString(),
  endpoint: CATALOG_URL,
  profile: PROFILE,
  limit: LIMIT,
  shipsTo: SHIPS_TO,
  note: "Same query as the general search, plus a Color filter, limited to products Catalog says can ship to 94582. No material word in the query. Page size is 12 per band. Shown when the entered color matches. Green pillows are stored on couch pillows, chair pillows, and additional pillows, using each item's own price bands.",
  slices,
};

await writeFile(new URL("../data/live-slices.json", import.meta.url), `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(`wrote ${slices.length} searches`);
