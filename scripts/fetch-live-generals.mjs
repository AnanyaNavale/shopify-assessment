import { readFile, writeFile } from "node:fs/promises";

const LIMIT = 12;
const SHIPS_TO = { country: "US", region: "CA", postal_code: "94582" };
const CATALOG_URL = "https://catalog.shopify.com/api/ucp/mcp";
const PROFILE =
  "https://shopify.dev/ucp/agent-profiles/examples/2026-08-25/valid-with-capabilities.json";

const SEARCHES = [
  { itemId: "couch", query: "couch" },
  { itemId: "chairs", query: "armchair" },
  { itemId: "coffee-table", query: "coffee table" },
  { itemId: "cabinet", query: "cabinet" },
  { itemId: "couch-pillows", query: "throw pillow" },
  { itemId: "chair-pillows", query: "throw pillow" },
  { itemId: "additional-pillows", query: "throw pillow" },
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
    matchesPreference: false,
    automaticPromotion: null,
  };
}

const bandsFile = JSON.parse(await readFile(new URL("../data/bands.json", import.meta.url), "utf8"));
const bandsByItem = new Map(bandsFile.items.map((item) => [item.itemId, item.bands]));
const items = [];
let requestId = 1;

for (const search of SEARCHES) {
  const bands = bandsByItem.get(search.itemId);
  const saved = [];
  const listings = [];
  for (let index = 0; index < bands.length; index += 1) {
    const result = await searchCatalog(requestId, {
      query: search.query,
      filters: {
        price: priceFilter(bands[index]),
        ships_to: SHIPS_TO,
      },
      pagination: { limit: LIMIT },
    });
    requestId += 1;
    saved.push({ generalCount: result.pagination.total_count });
    const seen = new Set();
    for (const product of result.products) {
      const listing = toListing(product, search.itemId, index);
      if (!listing || seen.has(listing.id)) {
        continue;
      }
      seen.add(listing.id);
      listings.push(listing);
    }
    console.log(
      `${search.query} ${search.itemId} band ${index}: ${result.pagination.total_count}, listings ${seen.size}`,
    );
    await wait(900);
  }
  items.push({ itemId: search.itemId, query: search.query, bands: saved, listings });
}

await writeFile(
  new URL("../data/live-generals.json", import.meta.url),
  `${JSON.stringify(
    {
      source: "catalog",
      fetchedAt: new Date().toISOString(),
      limit: LIMIT,
      shipsTo: SHIPS_TO,
      note: "General Catalog searches with no color filter. Material words are left out of the query. Each band stores the estimated count and the first 12 products that Catalog says can ship to 94582.",
      items,
    },
    null,
    2,
  )}\n`,
);
console.log(`wrote ${items.length} general searches`);
