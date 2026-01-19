# Cruise Template Rendering Fixes

## Goal

Fix multiple missing or incomplete sections in the cruise template for the Greek cruise trip, including booking details, cabin enhancements, included value, TripAdvisor info, and Viator tours. Hide proposal-only pricing when the trip is confirmed.

## Scope

- Booking Details cards should render key fields from `bookings[]`.
- Cabin section should show images, location notes, and complimentary services.
- Included Value section should render `celestyalBenefits` details.
- Flight Options should show self-book notes and disclaimers.
- Lodging should show TripAdvisor data when available.
- Viator tours should render by port.
- Tiered pricing and investment summary should be hidden when `meta.phase` is `confirmed`.

## Plan

1) Template data shaping
- Normalize booking fields (icon, status badge, travelers text).
- Normalize recommended extras priority order.
- Group Viator tours by port for rendering.
- Merge `cruiseInfo.cabin.images` with `images.cabin` when both exist.
- Compute `_config.showTiers` based on `meta.phase`.

2) Cruise template updates
- Replace Booking Details card markup with new fields.
- Add cabin location note and complimentary services list.
- Render cabin thumbnails as links to full-size images.
- Add Included Value section from `celestyalBenefits`.
- Add `flightOptions.selfBookNote` and `flightOptions.disclaimer` callouts.
- Add TripAdvisor summary block inside lodging cards.
- Add Viator tours section grouped by port.
- Gate tiered pricing and investment summary with `_config.showTiers`.

3) Publish + verify
- Upload `cruise.html` to KV templates.
- Preview publish trip `greek-cruise-may-2026`.
- Verify draft URL renders all new sections and hides tiers for confirmed trips.

## Verification Checklist

- Booking Details cards show type, supplier, confirmation, amount, balance, travelers, and notes.
- Cabin section shows location note, features, complimentary services, and both images (photo + floorplan).
- Included Value section shows items and total value; transfers and meeting instructions show if present.
- Flight Options show self-book note and disclaimer.
- Lodging cards show TripAdvisor rating/ranking/review count and tips.
- Viator tours render by port with cards.
- Package Options and Investment Summary are hidden when `meta.phase` is `confirmed`.

## Preview Command

```
curl -s -X POST "https://voygent.somotravel.workers.dev/sse?key=Kim.d63b7658" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"preview_publish","arguments":{"tripId":"greek-cruise-may-2026"}}}'
```
