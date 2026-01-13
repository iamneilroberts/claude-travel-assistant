# Voygent Feature Roadmap

## Completed

### Sanity Check (`validate_trip`)
- Analyzes trip for logistics issues, missing info, scheduling problems
- AI-driven analysis (no hardcoded rules)
- Returns structured report with Critical Issues, Warnings, Suggestions

### Tiered Proposals
- **Default for all trips** - Claude creates value/premium/luxury tiers
- Schema supports `tiers.value`, `tiers.premium`, `tiers.luxury`
- Template renders side-by-side comparison cards
- Premium tier highlighted as "Recommended"
- Shows lodging, flights, extras per tier
- Mobile-responsive (stacks vertically on small screens)

### Quote Import (`import_quote`)
- Paste raw quote/confirmation text from booking system
- AI parses: prices, confirmation numbers, supplier names, dates
- Updates trip with real data
- Flags discrepancies vs. planned itinerary
- Supports: cruise, hotel, air, tour, package, insurance

### QR Codes
- Auto-generated QR code in footer of published pages
- Links to the page URL for easy mobile sharing
- Uses api.qrserver.com (free, no API key needed)

### Media Embeds (YouTube)
- Add `media` array with YouTube video IDs and captions
- Responsive embedded players in "Helpful Videos" section
- Good for: destination overviews, transit tips, walking tours

### Maps
- Google Maps Embed API showing destination
- Auto-displays if `meta.destination` is set
- Interactive map with zoom/pan controls

### Profit Maximizer (`analyze_profitability`)
- Analyzes trip for agent commission opportunities
- AI-driven estimates (no hardcoded math)
- Commission estimates by product type (cruise, hotel, insurance, etc.)
- Suggests upsells with commission impact
- Service fee recommendations based on complexity
- Optional "reach $X target" guidance

---

## Future Ideas

- PDF export
- Client-facing vs agent-facing views (hide costs)
- Flight price lookup integration
- Hotel availability check
- Weather forecast for travel dates
- Multi-language support
