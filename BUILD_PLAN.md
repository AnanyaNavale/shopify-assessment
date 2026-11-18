# Build Plan — Room Budget Planner (Shopify APM Take-Home)

*Version 6 — ready to build. Record of decisions made; video-related decisions deferred to §14. Latest additions: room total morphs from market plan toward the customer's budget, checklist toggles, mock-first data, automatic item-level discount.*

## 0. Instructions for Cursor (read first)

- This document records **product decisions already made by the product owner**. Implement them as written.
- Do **not** invent new product features, flows, or copy beyond what is described here.
- **[OPEN]** = undecided product question. **Stop and ask the product owner** before implementing it.
- **[CONFIRM]** = tentative decision. Implement it, but flag it back to the product owner.
- **[SUGGESTION]** = implementation default proposed for convenience; the product owner may override it.
- **[VERIFY]** = an API assumption not yet confirmed. Not required for the prototype.

### Prototype principle — DECIDED
**This is a prototype. Do not over-engineer.** Where the real data isn't available or would be complex to obtain, **mock it with realistic values and label it** — do not build fallbacks, edge-case handling, or workarounds for missing data. The goal is a clear, working demo of the core flow, not completeness or polish.

---

## 1. Problem & Scope

### Problem statement (How Might We) — DECIDED
> How might we help first-time home buyers and renters who are balancing a budget understand how much they should set aside to furnish their new accommodations at different levels (basic, upgraded basic, accessorized)?

- Renter-specific concerns (e.g., resale value) are **out of scope**.

### Definition of confidence — DECIDED
This tool helps people **make financial decisions about their furniture with confidence**: if a buyer can reasonably and comfortably distribute their money across the items needed to populate a single room, they will feel more confident in their spending. (Whether they ultimately buy depends on other aspects of the goods available, which the tool doesn't control.)

The doubt being removed, in two directions:
- **Overpaying:** "Am I paying more than I need to for something I could get at a better price and enjoy as much or more?"
- **Underspending:** "Am I selling myself short when I could actually afford more for this part of the room?"

And at the room level:
- **"If I buy this, can I still afford the rest?"** — e.g., a chair shouldn't cost $5,000 when the couch already cost $5,000.

### Purchase-confidence factors: what this product covers

| Factor | Status |
|---|---|
| Spending fits the whole room plan | **Core** |
| Paying a reasonable price for the item | **Core** (price distribution chart) |
| Knowing the estimated total cost | **Core** — mocked shipping allowance, labeled |
| Quality vouched for by others | **Partial** — product ratings |
| Color / material match | **Partial** — buyer specifies; data is coarse |
| Seller | Seller/store name shown |
| Sale / stock signals | **Included** — icons + detail modal |
| Return policy | Out of scope for prototype (future) |
| Seeing it in the space / physical fit | Out of scope |
| Working with other pieces (style) | Out of scope |
| Durability, delivery, warranty, installments, resale value | Out of scope (future) |

### Target user & assumptions — DECIDED
- First-time furnisher: first-time home buyer or renter at the moving-in stage.
- Has **no idea what a total furnishing budget should be**, nor what quality items typically cost.
- **Knows (roughly) their taste**: the pieces they want, optionally a preferred material and/or color. If unspecified, the tool still works.
- Sees furnishing as a **long, layered process** they don't want to rush, and wants facts before starting.

### Evidence / why it matters — DECIDED (wording to finalize)
- **Real story:** the product owner went couch-shopping with their parents (~2 years ago) across department stores and online retailers. They weighed what they valued in a couch, what they could afford **once a couch was combined with chairs and a coffee table**, and color scheme. They spent a lot on the couch, and the parent is now very sale-conscious buying the chairs and coffee table — the room-level reference point ("a chair shouldn't cost $5,000 when the couch cost $5,000") came **after** the big purchase, not before.
- **Supporting data (cite in demo if used):**
  - NAHB (Aug 2026, Consumer Expenditure Survey 2020–2023): buyers of existing homes spend ~$18,673 on appliances, furnishings, and remodeling in the first year after purchase — about twice non-moving homeowners.
  - UK survey (Censuswide for British Heart Foundation, 2019): 58% of first-time buyers and renters said they didn't have the money to furnish their new home; at least 1 in 4 waited weeks for key items like sofas.
  - Statistics Canada: homebuyers don't buy all the furniture they need in the first year; furniture shopping continues for several years after a move (supports "long, layered journey").
- Final wording: deferred — see §14 (video decisions).

### Explicitly OUT of scope — DECIDED
- Developing or refining taste; fabric feel; seeing items in the space (AR / computer vision).
- AI interior designer/decorator; color-scheme creation and precise color matching.
- Written reviews; return-policy summaries (future); seller ratings.
- Whole-house planning (one room only; the "house fund" gestures toward it).
- Merchant-side tool (future — §9).
- Listing-level "budget impact preview" (future).
- Customer-entered total budget (see §4.7).

---

## 2. Product placement & form — DECIDED (form to confirm)

- Intended home: a **built-in tool inside Shop** — Shopify's consumer app, which also runs on the web at shop.app (desktop and mobile browsers).
- DECIDED: Prototype form: a **desktop web layout**, presented as part of **Shop on the web**. Rationale: the key moments are visual and side-by-side (checking an item changes other budgets), which a desktop screen shows in one view; planning a room's budget is a sit-down task; the demo video is watched on a computer.
- A mobile/app version is future work (§13).
- If using a "Trivago for furniture" analogy, clarify it compares the **price landscape of a product category**, not the same item across sites.

---

## 3. Core user flow (happy path)

1. User enters a **postal code** (only products that ship to them).
2. User sees the **living room checklist** in three tiers, with editable quantities and drag-to-reorder priorities. **The marketplace sets the initial budget** for each item.
3. User selects an item (e.g., couch) and optionally enters **material** and/or **color**.
4. Tool shows a **stacked price-distribution chart** (5 bands; user's matches vs. the whole market) and a plain-language **summary note**.
5. The **highlighted band** sets that item's **budget range** (incl. a labeled shipping allowance).
6. User clicks a bar → **listings in that band**: preferred matches first, then the rest. Icons for sale/stock; click a listing for a **detail modal**.
7. User checks an item → added to a **UCP cart** → **estimated total** → compared to the budget range → **rebalancing** (slashed/changed values).
8. Under budget → pop-up: reallocate to other items or save to the **house fund**.
9. **Final cart view**: every checklist item assigned, green/red total, factual summary.
10. Checkout **hands off to each merchant**.

The customer **refines the budget through her choices** (selections, quantities, priorities) — she never has to state a total.

**Build the core flow (steps 3–7) first.**

---

## 4. Feature specifications

### 4.1 Location (postal code) — DECIDED
- Asked once at the start. Used for Catalog `context` + `ships_to` (only products that ship to her) and as a cart `context` hint.
- No tax estimate on the chart.

### 4.2 Room & budget checklist — DECIDED
Living room, three tiers. **Quantity editable** for every item.

| Tier | Items (default qty) |
|---|---|
| **Tier 1 — Basics** | Couch (1); Chairs (1–2); Coffee table (1) |
| **Tier 2 — Upgraded basics** | Cabinet (1, top of tier); Couch pillows (2 per couch); Chair pillows (1 per chair) |
| **Tier 3 — Accessories** | Additional pillows (as desired); Side tables; Artsy add-ons: wall painting, lamp, books, candles, posters |

- **Priorities:** the list order **is** the priority order — **top = highest, bottom = lowest**. The customer can **drag to reorder** items within the list (tiers still group the list). Default order = the order in the table above.
- An item's budget = per-unit range × quantity.
- Each item's budget range includes a **labeled shipping allowance**.
- DECIDED: every item can be **toggled on or off** as the customer sees fit. In the default template, all items listed above start **on** (including the cabinet, at the top of Tier 2). Toggling an item off removes its budget from the room total; toggling on adds it back.

### 4.3 Preference input (per item) — DECIDED
- Item type — required. Material — optional **search keyword**. Color — optional **Color filter**.
- Material and color are **judging criteria** that shape the explanation.

### 4.4 Price-distribution chart — DECIDED
- **Stacked bar chart**, **5 bands** for every item; boundaries **depend on the item**.
- **X-axis:** price bands. **Y-axis:** **number of products**.
- Per band: `total_count_1` (general) = full bar (gray); `total_count_2` (filtered) = colored segment from the **bottom**; clamp if filtered > general.
- Labels show counts/percentages; counts are estimates ("~").
- **Highlighted band:**
  - **With preferences:** the band with the tallest colored segment. Tiebreaker: ratings; then show the tie.
  - **Without preferences:** the **middle band** (3rd of 5).
- [SUGGESTION] Band boundaries: a **hardcoded table of 5 boundaries per item type**; top band open-ended ("$X+").

### 4.5 Summary note — DECIDED
- States where most matching options sit, phrased as **availability**, not a verdict.
- Comparison as a **percentile in plain words** — e.g., "Most blue velvet couches are priced higher than about 70% of all couches." (Approximated from band counts; no need to be exact.)
- If notably higher: suggest alternative materials/colors to spend less. If lower: state neutrally; keep spending more open — **never push**.
- No comparison note if no material/color was given.
- This text is the prototype's **AI-generated** element (§8); pre-written in the prototype is fine.

### 4.6 Listings & detail modal — DECIDED
**On bar click**, two lists below the chart:
1. **Closest to her preferences**, ranked by **rating**.
2. **Others in this price band**.

**Each listing row:** image, title, list price, **seller/store name**, product rating, checkbox, and **icons** for: on sale, running low.

**Detail modal (on click):** seller/store, product rating, sale (original price slashed → current), running low, other product details.

Not in prototype: return policy summaries, seller ratings, listing-level estimated totals or budget-impact previews.

### 4.7 Initial budget — DECIDED
- **The marketplace sets the initial budget.** The customer never enters a total.
- Each item's initial range = its **highlighted band** (with preferences) or the **middle band** (without), × quantity, + shipping allowance.
- **Room total** = sum across the checklist.
- DECIDED: the **room total starts as the market's plan** and **morphs toward the customer's own budget** as she makes decisions:
  - **Overspending** does not grow the total — it's absorbed by cutting lower-priority budgets (rebalancing, §4.8).
  - **Underspending** → pop-up lets her **reduce the room's overall budget** by moving the surplus to the **house fund**, or reallocate it within the room.
  - **Toggling items off** removes their budget from the total; **quantities** scale it.
- If an overspend is too large for lower priorities to absorb, the total simply shows **red** (§4.11) — no further handling in the prototype.
- No customer-entered total and no proportional scale-down step (possible future work: optional "I can only spend $X" input).

### 4.8 Rebalancing rules — DECIDED
Triggered when a checked item's **cart estimate** is compared to its budget range.

- **Range adjustment:** lower the **ceiling** first; **once nothing viable remains in the range, the floor lowers too** (the range slides down).
- **Overspending:** cut from **lowest-priority items first** (bottom of the list). Tell the customer the trade-off (e.g., "If you get this couch, you may need to go lower on your side tables to stay within budget.").
- **Underspending** → pop-up: (1) add to **next-highest or same-priority** item; or (2) save to the **house fund**.
- **Cutting triggers:**
  - **A:** a higher-priority item's range is too small to include anything useful → draws funds from lower-priority items.
  - **B:** a lower-priority item's range becomes too small to include anything useful → it's **cut**; its funds shift up.
  - "Too small" = ceiling below the cheapest product available for that item.
- **Visual:** old value **slashed through** next to the new value.

### 4.9 House fund — DECIDED
- Running total of money saved from underspending, reserved for other rooms. Displayed persistently.

### 4.10 Cart & shipping (UCP) — DECIDED
- Checked items go into a **UCP cart** (Universal Cart across merchants).
- Shipping: a **mocked allowance**, conceptually based on a median-priced item for that product type, **labeled** (e.g., "Shipping: est. allowance — final at checkout").
- Checkout **hands off to the merchant storefront**.
- **Automatic item-level discount — DECIDED (keep minimal):**
  - In the mock data, **one listing** has a merchant's **automatic promotion** (no code needed).
  - When that item is checked, the cart estimate shows a **discount line** under that item and a lower total for it.
  - The discounted total flows into **normal rebalancing** — no new logic. If it lands under the item's range, the existing **underspend pop-up** appears (reallocate or house fund).
  - Label it plainly (e.g., "Merchant promotion applied: −$X").
  - Not in the prototype: discount code entry, order-level discounts, discovering available codes.
  - Background: UCP's discount extension reports automatic discounts and allocates them to specific line items; support varies by merchant (some only at checkout), so not every item will have one.
- Background (for the demo/Reflection, not for building): Shopify's docs say cart totals are estimates that may omit shipping until checkout, and postal code is a hint, not a shipping address.

### 4.11 Final cart view & summary — DECIDED
- Every checklist item assigned to a listing, grouped by merchant as needed.
- Room total **green** (within/under) or **red** (over).
- **Factual copy**, e.g.:
  - Within: "Your cart value lands within the budgeted range." + "$X under budget."
  - Over: amount over + a concrete suggestion (e.g., "Try cutting the side tables to reserve more for your chairs.").
  - Leftover: "You have $X left over from this room. Upgrade something here, or save it to your house fund for another room?"
- Shipping shown as a labeled allowance.

---

## 5. Where UCP appears (make this visible in the demo)

1. **Discovery:** Catalog searches go through the UCP endpoint (`/api/ucp/mcp`), authenticated by the app's **UCP agent profile**.
2. **Cart:** checked items are held in UCP carts (Universal Cart across merchants).
3. **Estimated cost:** cart totals (+ shipping allowance) feed the budget and rebalancing — including **automatic merchant discounts** allocated to a specific item (discount extension).
4. **Checkout:** cart converts to checkout and hands off to merchants.

Landing moment 3 (§14) is the primary UCP moment.

---

## 6. Data & API notes (for reference)

> Docs: https://shopify.dev/docs/agents — Shopify notes URLs may change.

- Catalog endpoint: `POST https://catalog.shopify.com/api/ucp/mcp` (JSON-RPC). Every request includes `meta.ucp-agent.profile` (URL to the app's **UCP agent profile**, hosted publicly) declaring `dev.ucp.shopping.catalog.search`, `dev.ucp.shopping.catalog.lookup`, `dev.shopify.catalog.global`.
- `search_catalog` inputs used: `query` (material keyword), `filters.price` (min/max in **cents**), `filters.attributes` (`Color`), `filters.ships_to`, `context` (postal code etc.), `pagination.limit`.
- Outputs used: products (title, URL, price, media, `list_price`, `running_low`, rating, seller name), `pagination.total_count` (estimate).
- **Data approach:** per band, `search_catalog` with band min/max and `limit: 1`; read `total_count`. Twice per band (general + filtered) → 10 calls per item. Bar click → one search for listings.
- [VERIFY — not required for prototype] Whether `total_count` exceeds 1,000; whether carts return tax/shipping pre-checkout.

### Known data limitations (Reflection candidates — do not engineer around)
- `total_count` is an **estimate**; percentile is approximate.
- Material is keyword-matched; some product text is AI-inferred by Shopify.
- Color is a coarse label.
- Chart shows **supply**, not demand; counts can be skewed by near-identical listings.
- Product ratings only; no seller ratings or written reviews.
- No price history.
- Shipping usually unknown until checkout.

---

## 7. Prototype build approach — DECIDED (data mode and form to confirm)

- DECIDED: **Code prototype built in Cursor.** Rebalancing logic runs for real on the data.
- DECIDED: **Data — mock first, live last (optional):**
  1. Build the entire prototype on a realistic **mock dataset** shaped exactly like Catalog responses (band counts, listings).
  2. **Only after milestones 1–7 work**, if time remains: time-box (~30–45 min) one live Catalog search for the demo item (couch: 5 bands × general + filtered, plus listings), **save results to JSON**, and swap them into the data layer.
  3. If the live attempt doesn't work in the time box, keep the mock data — no further effort.
  4. Cart/checkout always **mocked**.
  5. State in the demo what's real vs. simulated.
- [SUGGESTION] All data access behind one small data layer so mock/cached/live are interchangeable.

### Form & stack — [SUGGESTION] (product owner delegated the recommendation)
- DECIDED: **Desktop web app**, styled to feel like part of Shop on the web (shop.app).
  - **Desktop only** — do not build a responsive mobile layout (not needed for the demo).
  - Rationale: clearest for the demo's visuals; fast to build; easy to screen-record; live Catalog calls need a server anyway (agent profile hosting), which a web framework provides.
  - Alternatives considered: mobile-first web in a phone frame (narrower view hides cause-and-effect between chart and checklist); React Native / Expo (more setup, separate backend still needed).
- **Next.js (React) + TypeScript**, **Tailwind CSS**, **Recharts** (stacked bars with click handlers), drag-to-reorder via a lightweight library (e.g., `dnd-kit`).
- Optional **Vercel** deploy (public URL; can host the UCP agent profile if testing live).
- Data: JSON files in the repo.

---

## 8. Role of AI — DECIDED

- Budget numbers are **deterministic** (predictable and explainable): band highlighting, budget ranges, rebalancing are rules.
- AI is used where it does work rules can't: **writing the plain-language summary note** under the chart (§4.5).
- In the prototype, the summary text may be pre-written; the demo notes it would be AI-generated in production.
- Future AI uses (not in prototype): return-policy summaries; interpreting free-text preferences; cleaning results.
- The app is an **agent** in Shopify's terms regardless (it presents a UCP agent profile).

---

## 9. Merchant value — DECIDED framing (placement open)

### Inside the buyer tool
- Buyers arrive matched on taste and budget → more relevant traffic.
- Confident buyers hesitate and return less.
- Legitimate "room to upgrade" moments without pushiness.
- Clear cost expectations reduce surprise abandonment at checkout.

### Merchant-side extension: marketplace pricing gauge (future work)
- New merchants see the **price distribution** of their item type across the Shopify marketplace → where competitors price → which **customer tier** to serve → **gaps** where buyers are underserved.
- Customer tiers (generic labels for the demo):
  - **Budget / functional** — practical, affordable basics.
  - **Mid-range / everyday comfort** — durable, comfortable family pieces.
  - **Premium / designer** — high-end materials and brand-led design.
- Connection to "reach relevant buyers": merchants can price into the range relevant buyers are already looking at.
- Caveats: the chart shows **supply** — a gap doesn't prove **demand**; if both sides steer toward highlighted bands, prices may converge.
- Where it's mentioned in the video: deferred — see §14 (video decisions).

---

## 10. Design principles — DECIDED

- **No wool over her eyes:** never hide market information; every bar traces to real listings; every total says what it includes.
- **Don't make her head spin:** simple first view; detail on demand (icons → modal).
- **Inform, don't decide:** facts and plain-language percentiles; editable defaults; ties shown; factual copy, not praise.
- **No pushiness:** underspending options offered, never urged.

### UI/UX — product owner will design after basics are in place
- Product owner will refine layouts, pop-up, house fund display, and styling **after the basics work**. Polish is not a priority.
- **Cursor: do not stop for UI questions.** Use a simple, clean **desktop default layout** so the product owner can refine it later:
  - **Main area (left/center):** preference input, stacked price chart + summary note, and listings below it.
  - **Side panel (right), always visible:** the budget checklist (tiers, priorities, ranges, slashed values), room total, and house fund.
  - Goal: when an item is checked, the viewer sees the **budget changes happen at the same time**, in the same view.
  - Final cart view can be its own screen.

---

## 11. Build order (milestones)

1. **Project setup** (desktop layout: main area + budget side panel) + **data layer** with mock or cached data.
2. **Postal code entry** + preference input (item, material, color).
3. **Stacked chart** (5 bands) + highlighted band + summary note. *(Landing moment 1)*
4. **Bar click → two-list listings** with checkboxes, icons, detail modal.
5. **Budget checklist** (3 tiers, editable quantities, drag-to-reorder priorities, ranges incl. shipping allowance).
6. **Cart estimate on check** (mocked, incl. one automatic item-level discount) → **rebalancing** + slashed values. *(Landing moment 2)*
7. **Final cart view** with green/red total + factual summary. *(Landing moment 3)*
8. **Underspend pop-up** + house fund (incl. reducing the room total).
9. **Checkout handoff** screen.
10. *(Optional)* **Live Catalog swap-in** — time-boxed (§7).

Milestones 1–7 carry the demo. If time is short, stop after 7.

---

## 12. Remaining open decisions

**None blocking the build.** UI/UX refinement happens after the basics work (§10); Cursor uses a simple default layout until then.

Video-related decisions are kept separately in **§14 → Video decisions (deferred)**. They are **not needed for the build**.

**To confirm:** none — all confirmations resolved.
**Decided:** room total starts as the market plan and morphs toward the customer's budget (4.7); data mode is mock first, live last (7).
**Decided since v5:** checklist items toggle on/off, cabinet on at top of Tier 2 (4.2); desktop web layout presented as Shop on the web (2, 7, 10); "why it matters" wording to be finalized after the build.

---

## 13. Future work (for the demo's Reflection — do not build)

- **Merchant pricing gauge** for new merchants (§9).
- **Return-policy scraping + AI summaries** (3–5 word checks on each listing).
- Listing-level **budget-impact preview** ("what my room budget looks like if I pick this").
- Seller ratings.
- Seeing items in the space / physical fit (dimensions, AR).
- Color-scheme helper and accurate color identification.
- Fabric/material accuracy beyond keyword matching.
- Skew correction for supply data; demand signals alongside supply.
- Discount code entry (codes the buyer already has from merchant emails/sites); order-level discounts.
- Real tax/shipping estimates; written reviews; durability/warranty; delivery; installments; resale value (renters).
- Price history.
- Optional customer-entered room budget ("I can only spend $X").
- **Mobile / Shop app version** — e.g., chart and checklist as separate tabbed views on a phone screen.
- Whole-house planning using the house fund across rooms.

---

## 14. Video plan & submission

### Structure (≤ 3:00)
- ~0:00–0:30 — **Problem + why it matters** (couch-shopping story; optionally one statistic); state the **definition of confidence** and what's out of scope.
- ~0:30–2:15 — **Three landing moments** (~35 seconds each). DECIDED:
  1. **Understand the market:** enter material/color for an item → stacked chart with highlighted band → plain-language percentile summary.
  2. **Make a trade-off:** select an item that goes **over budget** → checklist shows **rebalancing** (slashed values, trade-off message).
  3. **Finish with confidence:** final cart with every checklist item assigned → **green/red total** + factual summary (incl. leftover → upgrade or house fund). **Primary UCP moment.**
- ~2:15–3:00 — **Reflection:** weakest part, what would change with more resources, what's next (§13).

### Video decisions (deferred — not needed for the build)
Cursor: ignore this list. The product owner will decide these when planning the recording.
1. Final wording of the 1–2 **"why it matters"** lines (and whether to use one supporting statistic — see §1).
2. Where the **merchant pricing gauge** is mentioned: at landing moment 1, or in the Reflection (§9).
3. Whether the **automatic discount** appears in the video (e.g., in landing moment 2 or 3) or only in the build (§4.10).

### Submission
- Video ≤ 3:00, prototype on screen.
- Export **every** AI chat transcript as Markdown (this planning chat + all Cursor chats); zip if more than one.
