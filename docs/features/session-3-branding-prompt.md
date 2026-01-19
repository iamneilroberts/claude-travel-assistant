# Session 3: Branding, Assets & System Prompt

## Goal

Update branding assets (logo, contact info, agent photo), add Viator affiliate tracking, and enhance the system prompt with intelligent tour recommendations based on available port time.

## Scope

- Update Kim's contact info in templates
- Use official Cruise Planners logo
- Use Kim's thumbnail photo
- Add Viator referral codes to URLs
- Enhance prompt: analyze available time after included tours
- Enhance prompt: recommend 1 Viator + 1 cruise line tour per day

## Files to Modify

| File | Changes |
|------|---------|
| `src/templates/cruise.html` | Update footer contact info, logo references |
| `src/templates/default.html` | Update footer contact info, logo references |
| `prompts/system-prompt.md` | Add tour recommendation guidance |
| `src/template-renderer.ts` | Add Viator affiliate code injection |

## Available Assets

```
cloudflare-mcp-kv-store/images/
├── CPLogoMain.jpg       ← Official Cruise Planners logo
├── kimThumbnail.png     ← Kim's photo
└── emailsig.png         ← Reference for contact info
```

## Plan

### Item 4: Viator Referral Codes

**Requirement:** All Viator URLs should include the agent's affiliate tracking

**Schema:** Affiliate IDs are stored in `UserProfile.affiliates` (see `src/types.ts`):
```typescript
export interface AffiliateIds {
  viator?: {
    partnerId: string;    // pid parameter
    campaignId: string;   // mcid parameter
  };
  getYourGuide?: { partnerId: string };
  expedia?: { affiliateId: string };
  cruiseWatch?: { agentId: string };
}
```

**Viator Affiliate URL Format:**
```
https://www.viator.com/tours/Athens/...?pid=P00XXXXX&mcid=XXXXX&medium=link
```

**Implementation in template-renderer.ts:**
```typescript
import { UserProfile } from './types';

function addViatorTracking(url: string, userProfile: UserProfile | null): string {
  if (!url || !url.includes('viator.com')) return url;

  // Get affiliate params from user profile
  const viatorAffiliates = userProfile?.affiliates?.viator;
  if (!viatorAffiliates?.partnerId) return url; // No affiliate tracking configured

  try {
    const urlObj = new URL(url);
    // Don't add if already has tracking
    if (urlObj.searchParams.has('pid')) return url;

    urlObj.searchParams.set('pid', viatorAffiliates.partnerId);
    if (viatorAffiliates.campaignId) {
      urlObj.searchParams.set('mcid', viatorAffiliates.campaignId);
    }
    urlObj.searchParams.set('medium', 'link');
    return urlObj.toString();
  } catch {
    // If URL parsing fails, append manually
    const separator = url.includes('?') ? '&' : '?';
    let params = `pid=${viatorAffiliates.partnerId}`;
    if (viatorAffiliates.campaignId) {
      params += `&mcid=${viatorAffiliates.campaignId}`;
    }
    return `${url}${separator}${params}&medium=link`;
  }
}

// Apply to all viator tours in trip data
function processViatorUrls(tripData: any, userProfile: UserProfile | null): any {
  // Process viatorTours array
  if (tripData.viatorTours) {
    tripData.viatorTours = tripData.viatorTours.map((tour: any) => ({
      ...tour,
      url: addViatorTracking(tour.url, userProfile),
      bookingUrl: addViatorTracking(tour.bookingUrl, userProfile)
    }));
  }

  // Process excursions that are from Viator
  if (tripData.excursions) {
    tripData.excursions = tripData.excursions.map((exc: any) => {
      if (exc.provider?.toLowerCase() === 'viator' || exc.url?.includes('viator.com')) {
        return {
          ...exc,
          url: addViatorTracking(exc.url, userProfile)
        };
      }
      return exc;
    });
  }

  // Process recommended extras
  if (tripData.recommendedExtras) {
    tripData.recommendedExtras = tripData.recommendedExtras.map((extra: any) => {
      if (extra.url?.includes('viator.com')) {
        return {
          ...extra,
          url: addViatorTracking(extra.url, userProfile)
        };
      }
      return extra;
    });
  }

  return tripData;
}
```

**To set Kim's affiliate IDs:** Update her user profile in KV:
```bash
# Fetch current profile
curl -s "https://voygent.somotravel.workers.dev/admin/user/kim_d63b7658?key=ADMIN_KEY"

# Update with affiliate IDs (via admin endpoint or wrangler)
npx wrangler kv:key put "_users/kim_d63b7658" --namespace-id=NAMESPACE_ID '{
  ...existingProfile,
  "affiliates": {
    "viator": {
      "partnerId": "P00XXXXX",
      "campaignId": "XXXXX"
    }
  }
}'
```

---

### Item 18: Update Kim's Contact Info

**From emailsig.png:**
```
Kim Henderson
Cruise & Tour Specialist
Associate of Susie & Brad Jones,
A Cruise Planners® Independent Franchise Owner
t. 251-289-1505
e. kim.henderson@cruiseplanners.com
w. www.somotravelspecialist.com
```

**Current footer (cruise.html lines 3497-3502):**
```html
<div class="footer-section">
    <h4>Contact Your Travel Advisor</h4>
    <p>
        📞 <a href="tel:251-293-4992">251-293-4992</a><br>
        🌐 <a href="https://www.somotravelspecialist.com">somotravelspecialist.com</a>
    </p>
</div>
```

**Updated footer:**
```html
<div class="footer-section advisor-info">
    <h4>Your Travel Advisor</h4>
    <div class="advisor-card">
        <img src="https://voygent.somotravel.workers.dev/images/kimThumbnail.png"
             alt="Kim Henderson"
             class="advisor-photo"
             onerror="this.style.display='none'">
        <div class="advisor-details">
            <div class="advisor-name">Kim Henderson</div>
            <div class="advisor-title">Cruise & Tour Specialist</div>
            <div class="advisor-affiliation">Associate of Susie & Brad Jones</div>
            <div class="advisor-franchise">Cruise Planners® Independent Franchise Owner</div>
            <div class="advisor-contact">
                <a href="tel:+12512891505" class="contact-link phone">📞 251-289-1505</a>
                <a href="mailto:kim.henderson@cruiseplanners.com" class="contact-link email">✉️ kim.henderson@cruiseplanners.com</a>
                <a href="https://www.somotravelspecialist.com" target="_blank" class="contact-link web">🌐 somotravelspecialist.com</a>
            </div>
        </div>
    </div>
</div>
```

**CSS additions:**
```css
.advisor-card {
    display: flex;
    gap: 15px;
    align-items: flex-start;
}

.advisor-photo {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    object-fit: cover;
    border: 3px solid var(--secondary);
}

.advisor-details {
    flex: 1;
}

.advisor-name {
    font-weight: 700;
    font-size: 1.1em;
    color: var(--white);
}

.advisor-title {
    color: var(--secondary-light);
    font-size: 0.95em;
    margin-bottom: 5px;
}

.advisor-affiliation,
.advisor-franchise {
    font-size: 0.85em;
    color: var(--secondary);
    line-height: 1.4;
}

.advisor-contact {
    margin-top: 10px;
    display: flex;
    flex-direction: column;
    gap: 5px;
}

.contact-link {
    color: var(--white);
    text-decoration: none;
    font-size: 0.9em;
}

.contact-link:hover {
    color: var(--secondary-light);
}

.contact-link.phone {
    font-weight: 600;
}

@media (max-width: 600px) {
    .advisor-card {
        flex-direction: column;
        align-items: center;
        text-align: center;
    }

    .advisor-contact {
        align-items: center;
    }
}
```

---

### Item 19: Official Cruise Planners Logo

**Asset:** `images/CPLogoMain.jpg`

**Update header logo in cruise.html (line 46-55):**
```html
<div class="header-bar">
    <div class="logo-container">
        <img src="https://voygent.somotravel.workers.dev/images/CPLogoMain.jpg"
             alt="Cruise Planners"
             class="header-logo"
             onerror="this.style.display='none'">
        <span class="logo-text">SoMo Travel Specialist</span>
    </div>
    <div class="header-contact">
        <a href="tel:+12512891505">251-289-1505</a>
    </div>
</div>
```

**Same update for default.html**

**Ensure images are served:** Images need to be accessible via the worker. Add a route to serve static images:

```typescript
// In worker.ts - add image serving route
if (url.pathname.startsWith('/images/')) {
  const imageName = url.pathname.replace('/images/', '');
  // Serve from R2 bucket or embedded
  // ...
}
```

**Alternative:** Upload images to R2 and reference via R2 public URL, or embed as base64 in template.

---

### Item 20: Kim's Thumbnail Photo

**Asset:** `images/kimThumbnail.png`

**Usage:** In footer advisor section (see Item 18 above)

**Fallback handling:**
```html
<img src="https://voygent.somotravel.workers.dev/images/kimThumbnail.png"
     alt="Kim Henderson"
     class="advisor-photo"
     onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
<div class="advisor-photo-fallback" style="display:none;">KH</div>
```

**CSS for fallback:**
```css
.advisor-photo-fallback {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background: var(--secondary);
    color: var(--primary);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 1.5em;
}
```

---

### Item 5: Prompt Enhancement - Analyze Available Port Time

**Add to `prompts/system-prompt.md` under Cruise Trips section:**

```markdown
## Port Day Planning

When planning activities for port days, always calculate available free time:

### Time Analysis Process

1. **Get port schedule** from `cruiseInfo.ports[]`:
   - Arrival time (when ship docks)
   - Departure time (all-aboard time, typically 30 min before sailing)

2. **Account for included tours** from `excursions[]` where `included: true`:
   - Note start time and duration
   - Calculate when travelers will return to port area

3. **Calculate free time windows**:
   - Morning: From arrival to included tour start
   - Afternoon: From included tour end to all-aboard

4. **Tailor recommendations** based on available time:
   - < 2 hours: Suggest walkable attractions, quick bites, nearby shopping
   - 2-4 hours: Suggest one additional tour or extended exploration
   - 4+ hours: Can suggest a full half-day tour or multiple activities

### Example Analysis

```
Port: Mykonos
Arrives: 8:00 AM
Departs: 6:00 PM (all-aboard 5:30 PM)
Included Tour: "Mykonos Highlights" 9:00 AM - 1:00 PM

Free Time Windows:
- Morning: 8:00-9:00 AM (1 hour) → Coffee at port, stretch legs
- Afternoon: 1:00-5:30 PM (4.5 hours) → Recommend beach visit or town exploration

Recommendations:
1. After your included tour, you'll have 4.5 hours free
2. Option A: Paradise Beach (30 min taxi, 2-3 hours beach time)
3. Option B: Explore Little Venice and windmills (walkable, 2-3 hours)
4. Option C: Viator "Mykonos Food Tour" (2.5 hours, starts 2 PM)
```

### Time Formatting

Always present times in 12-hour format for client readability:
- "Your ship arrives at 8:00 AM" (not "08:00")
- "All-aboard is 5:30 PM" (not "17:30")
```

---

### Item 6: Prompt Enhancement - Tour Recommendations Per Day

**Add to `prompts/system-prompt.md` under Cruise Trips section:**

```markdown
## Tour Recommendations

For each cruise port day, provide balanced tour options from multiple providers:

### Recommendation Requirements

1. **Include at least one cruise line excursion** (when available):
   - Benefits: Guaranteed return to ship, often includes transport
   - Search the cruise line's shore excursion catalog
   - Note: "Ship-sponsored tour - guaranteed return to ship"

2. **Include at least one Viator tour** (when available):
   - Benefits: Often better value, smaller groups, more variety
   - Search Viator for the port destination
   - Note: "Independent tour - allow extra time to return to ship"

3. **Mark recommendations with provider** for client clarity:
   - Use `provider: "Celestyal Cruises"` or `provider: "Viator"`
   - Template will display provider badges

### Tour Data Format

```json
{
  "excursions": [
    {
      "port": "Santorini",
      "name": "Oia Village & Winery Tour",
      "provider": "Celestyal Cruises",
      "providerType": "cruise-line",
      "duration": "4 hours",
      "price": 89,
      "included": false,
      "description": "Visit iconic Oia, wine tasting at local vineyard",
      "highlights": ["Guaranteed ship return", "Air-conditioned transport"],
      "url": "https://celestyal.com/excursions/..."
    },
    {
      "port": "Santorini",
      "name": "Santorini Catamaran Cruise",
      "provider": "Viator",
      "providerType": "viator",
      "duration": "5 hours",
      "price": 125,
      "included": false,
      "description": "Sail the caldera, swim at hot springs, BBQ lunch",
      "highlights": ["Small group", "Lunch included", "Swimming stops"],
      "url": "https://www.viator.com/tours/Santorini/..."
    }
  ]
}
```

### Why Both Providers?

Explain to clients:
- **Cruise line tours**: Peace of mind - ship waits if tour runs late
- **Viator tours**: Often more authentic, better prices, unique experiences
- **Trade-off**: Independent tours require watching the clock

### Tour Time Buffer

For independent (Viator) tours:
- Recommend tours that end at least 1.5 hours before all-aboard
- Remind clients: "Allow 30-60 minutes to get back to the ship"
- If tour ends close to all-aboard, note the risk explicitly
```

---

## Image Hosting Strategy

**Recommendation: Use R2 (already set up)**

The R2 bucket `MEDIA` is already configured and serves images via `/media/` endpoint. This is the same infrastructure used for trip photos. Benefits:
- Already working and tested
- Long-term caching (1 year)
- No additional setup needed
- Consistent URL pattern

### Upload Branding Images to R2

```bash
cd cloudflare-mcp-kv-store

# Upload logo
npx wrangler r2 object put MEDIA/branding/CPLogoMain.jpg \
  --file=images/CPLogoMain.jpg \
  --content-type="image/jpeg"

# Upload Kim's thumbnail
npx wrangler r2 object put MEDIA/branding/kimThumbnail.png \
  --file=images/kimThumbnail.png \
  --content-type="image/png"
```

### Resulting URLs

After upload, images are served at:
- Logo: `https://voygent.somotravel.workers.dev/media/branding/CPLogoMain.jpg`
- Thumbnail: `https://voygent.somotravel.workers.dev/media/branding/kimThumbnail.png`

### Template References

Update templates to use:
```html
<!-- Header logo -->
<img src="https://voygent.somotravel.workers.dev/media/branding/CPLogoMain.jpg"
     alt="Cruise Planners" class="header-logo">

<!-- Footer thumbnail -->
<img src="https://voygent.somotravel.workers.dev/media/branding/kimThumbnail.png"
     alt="Kim Henderson" class="advisor-photo">
```

### Future: Per-User Branding

For multi-agent support, store branding images per user:
```
/media/branding/{userId}/logo.jpg
/media/branding/{userId}/thumbnail.png
```

And reference via `userProfile.agency.logo` URL stored in their profile.

---

## Verification Checklist

- [ ] Kim's contact info updated: 251-289-1505, kim.henderson@cruiseplanners.com
- [ ] Phone number is clickable (`tel:` link)
- [ ] Official CP logo displays in header
- [ ] Kim's thumbnail displays in footer
- [ ] Image fallbacks work if images fail to load
- [ ] Viator URLs include affiliate tracking parameters
- [ ] System prompt includes port time analysis guidance
- [ ] System prompt requires 1 Viator + 1 cruise line tour per day
- [ ] Tour data includes `provider` and `providerType` fields
- [ ] All images load correctly on published pages

## Action Items Before Implementation

1. **Get Kim's Viator affiliate credentials** (pid, mcid) and update her user profile
2. **Upload branding images to R2** (see Image Hosting Strategy section)

## Preview Command

```bash
curl -s -X POST "https://voygent.somotravel.workers.dev/sse?key=Kim.d63b7658" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"preview_publish","arguments":{"tripId":"greek-cruise-may-2026"}}}'
```
