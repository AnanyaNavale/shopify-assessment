# Room Budget Planner

A desktop prototype of a furnishing planner for [Shop on the web](https://shop.app). It helps someone furnishing a living room see what a reasonable budget looks like, pick real products inside that picture, and watch the rest of the room adjust when one choice costs more or less than planned.

The customer never types a total. The marketplace proposes a range for each piece. Their choices — which items to include, what color they want, which listing they pick, and what they are willing to give up — turn that proposal into their own budget.

## The problem

People furnishing a first home or a new rental usually do not know what a room should cost, or what “a normal price” is for a couch, a chair, or a lamp. They know roughly what they like. They do not know how to spread money across the whole room.

That shows up in two directions:

- **Overpaying.** Spending more than they need to for something they would enjoy just as much at a lower price.
- **Underspending.** Choosing less than they can actually afford, then living with it.
- **At the room level.** Finding out too late that one big purchase crowded out the rest. A chair should not cost as much as the couch if the couch already took the room’s money.

Furnishing is also slow. People buy a few pieces, wait, and fill the room over time. A useful plan has to survive that, including money set aside for later rooms.

This matters because the first year in a home is when furnishing spend spikes, and a large share of first-time buyers and renters say they do not have the money to furnish the place they just moved into. The expensive lesson often arrives after the couch is already bought.

## What this gives them

The planner is a way to make those money decisions with the room in view, before the big purchase locks the rest of the plan.

- A starting budget comes from the market, not from a blank number the shopper has to invent.
- A price chart shows where products in that category actually sit, and where their color sits inside that spread.
- Choosing a listing puts a real price on the checklist. If it runs past the plan, lower-priority pieces give up budget first. If it comes in under, the leftover can upgrade something else or go into a house fund for another room.
- The copy stays factual. It describes availability and the tradeoff. It does not tell the shopper what they should want.

What it does not try to do: develop taste, match a color scheme, show the furniture in the room, or plan the whole house. The house fund is only a running total reserved for other rooms.

## Features

The screen is a Shop-style header, a checklist on the left, and the chart and listings on the right. It is built for a desktop window.

**Checklist.** The list starts empty. The shopper adds living-room pieces from three tiers: basics (couch, chairs, coffee table), upgraded basics (cabinet and pillows), and accessories (side tables, art, lamp, books, candles, posters). Quantities are editable. Dragging reorders priority within a tier. Top of the list is the higher priority.

**Budgets from the market.** Each item’s range is a highlighted price band times quantity, plus a labeled shipping allowance. With no color chosen, that band is the middle of five. With a color, it is the band where matching products are most common. The room total is the sum of the items on the list.

**Price chart.** Selecting a checklist card opens that item’s chart: five stacked columns of product counts. A color filter compares matches with the rest of the market. Counts are estimates. Clicking a column opens listings for that band.

**Listings.** Each row shows a photo, title, price, seller, and rating, plus sale and low-stock tags when they apply. With a color selected, matches are grouped under “Closest to your preferences,” then “Others in this price band.” Checking a row assigns it to that checklist item. One listing can be selected per item. The card shows its photo and the price for the chosen quantity.

**Running spend.** Next to the room’s budget range, the right side shows the total of listings assigned so far, including each item’s shipping allowance.

**Rebalancing.** If a chosen listing is above its range, the difference is taken from lower-priority items that do not have a listing yet. Their ranges shrink. If a range can no longer hold a real product, that item is cut. The old figure is crossed out. A new figure turns red only when the range or the room total went up. If lower-priority items cannot cover the purchase, the room total states how far over it is, and the shopper can accept that figure with **Set as new budget**.

**Underspending.** If a listing comes in under its range, a prompt offers two uses for the difference: add it to another item, or save it to the house fund. The same choice is on the cart screen, under the leftover question.

**Cart and checkout.** Review cart groups selected listings by seller. Checkout is a mocked handoff to each seller. Shipping stays an allowance until that handoff. One saved listing can include an automatic merchant promotion; the discount is shown on the line and flows into the same budget math.

## What is real, and what is mocked

Saved Shopify Catalog searches cover the living-room items that can ship to postal code 94582 (US, California). Those searches use the item words only, plus a color filter when one was saved. Saved colors include white and blue couches, brown coffee tables, and green pillows. Chairs are saved as armchairs and cabinets as cabinets. Other items, and colors without a saved search, use realistic mock price bands and listings.

The postal code in the header does not run a new search. Shipping allowances, the cart, and checkout are mock. Product counts from Catalog are estimates.

## Setup

You need Node.js and npm. No API key is required to run the prototype. The Catalog results it uses are already saved in `data/`.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in a desktop browser. The layout is not built for a narrow window.

To build a production copy:

```bash
npm run build
npm start
```

`npm run fetch:couch` can refresh the saved couch search from Catalog. The app does not need that step to run.
