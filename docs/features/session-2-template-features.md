# Session 2: Template Features & Display Components

## Goal

Add new display features, fix interactive elements, and improve user experience: travel insurance section, prominent ship links, 12-hour time format, provider badges, functional navigation cards, privacy-focused traveler display, collapsible maps, and QR code fixes.

## Scope

- New travel insurance section (3 options with recommendations)
- Prominent deck plan and ship info links
- 12-hour time format helper
- Provider badges on tours (Viator, cruise line)
- Functional navigation in overview cards
- Travel party privacy display (indicators only, no PII)
- Collapsible maps section
- Fix "ask a question" footer text
- Fix QR code browser compatibility

## Files to Modify

| File | Changes |
|------|---------|
| `src/templates/cruise.html` | New sections, updated markup, JS for collapsible maps |
| `src/simple-template.ts` | Add `formatTime` helper for 12-hour format |
| `src/template-helpers.ts` | Add `formatTime` helper (Handlebars version) |
| `src/template-renderer.ts` | Add travel insurance data shaping |

## Plan

### Item 1: Travel Insurance Section

**Data Schema:**
```json
{
  "travelInsurance": {
    "note": "Price shown is estimate; final quote at booking",
    "options": [
      {
        "provider": "Travel Guard",
        "planName": "Basic Coverage",
        "price": 89,
        "pricePerPerson": 89,
        "coverage": ["Trip cancellation up to $5,000", "Medical up to $25,000", "Baggage up to $500"],
        "url": "https://...",
        "recommended": false
      },
      {
        "provider": "Travel Guard",
        "planName": "Preferred Coverage",
        "price": 149,
        "pricePerPerson": 149,
        "coverage": ["Trip cancellation up to $10,000", "Medical up to $100,000", "Baggage up to $1,500", "Cancel for any reason (75%)"],
        "url": "https://...",
        "recommended": true
      },
      {
        "provider": "Travel Guard",
        "planName": "Premium Coverage",
        "price": 229,
        "pricePerPerson": 229,
        "coverage": ["Trip cancellation up to full trip cost", "Medical up to $250,000", "Baggage up to $3,000", "Cancel for any reason (100%)", "24/7 concierge"],
        "url": "https://...",
        "recommended": false
      }
    ]
  }
}
```

**Template Markup:**
```html
{{#if travelInsurance}}
<div class="section" id="travel-insurance">
    <div class="section-header">
        <div class="section-icon">🛡️</div>
        <h2>Travel Insurance Options</h2>
        <button class="comment-trigger" data-comment-section="Travel Insurance">Ask a question</button>
    </div>

    {{#if travelInsurance.note}}
    <div class="info-callout">
        <p>{{travelInsurance.note}}</p>
    </div>
    {{/if}}

    <div class="insurance-options-grid">
        {{#each travelInsurance.options}}
        <div class="insurance-card {{#if recommended}}recommended{{/if}}">
            {{#if recommended}}<span class="recommended-badge">Recommended</span>{{/if}}
            <div class="insurance-header">
                <div class="plan-name">{{planName}}</div>
                <div class="provider">{{provider}}</div>
            </div>
            <div class="insurance-price">
                <span class="amount">{{formatCurrency pricePerPerson}}</span>
                <span class="per">per person</span>
            </div>
            <div class="insurance-coverage">
                <h5>Coverage Includes:</h5>
                <ul>
                    {{#each coverage}}
                    <li>{{this}}</li>
                    {{/each}}
                </ul>
            </div>
            {{#if url}}
            <a href="{{url}}" target="_blank" rel="noopener" class="card-link">View Full Details →</a>
            {{/if}}
        </div>
        {{/each}}
    </div>

    <p class="insurance-disclaimer">
        <em>Insurance pricing is estimated. Final quote provided at time of booking based on trip cost and traveler ages.</em>
    </p>
</div>
{{/if}}
```

**CSS (add to cruise.html styles):**
```css
.insurance-options-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 20px;
    margin-bottom: 20px;
}

.insurance-card {
    background: var(--white);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 20px;
    position: relative;
    box-shadow: var(--shadow);
}

.insurance-card.recommended {
    border: 2px solid var(--accent);
    transform: scale(1.02);
}

.insurance-card .recommended-badge {
    position: absolute;
    top: -10px;
    right: 15px;
    background: var(--accent);
    color: white;
    padding: 4px 12px;
    border-radius: 12px;
    font-size: 0.75em;
    font-weight: 600;
}

.insurance-header {
    margin-bottom: 15px;
}

.insurance-header .plan-name {
    font-size: 1.2em;
    font-weight: 700;
    color: var(--primary);
}

.insurance-header .provider {
    font-size: 0.85em;
    color: var(--text-light);
}

.insurance-price {
    background: var(--bg-light);
    padding: 12px;
    border-radius: 8px;
    text-align: center;
    margin-bottom: 15px;
}

.insurance-price .amount {
    font-size: 1.5em;
    font-weight: 700;
    color: var(--primary);
}

.insurance-price .per {
    font-size: 0.85em;
    color: var(--text-light);
    display: block;
}

.insurance-coverage h5 {
    font-size: 0.9em;
    color: var(--text);
    margin-bottom: 8px;
}

.insurance-coverage ul {
    margin: 0;
    padding-left: 18px;
    font-size: 0.9em;
}

.insurance-coverage li {
    margin-bottom: 5px;
}

.insurance-disclaimer {
    font-size: 0.85em;
    color: var(--text-light);
    margin-top: 15px;
}
```

**Data shaping (template-renderer.ts):**
```typescript
// Auto-recommend mid-price option if none marked
if (tripData.travelInsurance?.options?.length > 0) {
  const hasRecommended = tripData.travelInsurance.options.some((o: any) => o.recommended);
  if (!hasRecommended && tripData.travelInsurance.options.length >= 2) {
    // Mark middle option as recommended
    const midIndex = Math.floor(tripData.travelInsurance.options.length / 2);
    tripData.travelInsurance.options[midIndex].recommended = true;
  }
}
```

---

### Item 2: Prominent Deck Plan & Ship Info Links

**Current state:** Links exist but are inline with stateroom details (lines 1980-1993)

**Enhancement:** Add prominent link buttons at top of "Your Cruise" section

**Updated markup (after ship name in "Your Cruise"):**
```html
{{#if cruiseInfo}}
<div class="section" id="your-cruise">
    <div class="section-header">
        <div class="section-icon">🚢</div>
        <h2>Your Cruise</h2>
        <button class="comment-trigger" data-comment-section="Your Cruise">Ask a question</button>
    </div>
    <div class="content-box ship-card">
        {{#if cruiseInfo.shipUrl}}
        <a href="{{cruiseInfo.shipUrl}}" target="_blank" rel="noopener noreferrer" class="ship-name-link">{{cruiseInfo.shipName}} <span style="font-size: 0.6em;">↗</span></a>
        {{else}}
        <div class="ship-name">{{cruiseInfo.shipName}}</div>
        {{/if}}
        <div class="cruise-line">{{cruiseInfo.cruiseLine}}</div>

        <!-- NEW: Prominent quick links -->
        <div class="cruise-quick-links">
            {{#if cruiseInfo.shipUrl}}
            <a href="{{cruiseInfo.shipUrl}}" target="_blank" rel="noopener" class="quick-link ship-info">
                <span class="icon">🛳️</span>
                <span class="label">Ship Info</span>
            </a>
            {{/if}}
            {{#if cruiseInfo.deckPlanUrl}}
            <a href="{{cruiseInfo.deckPlanUrl}}" target="_blank" rel="noopener" class="quick-link deck-plan">
                <span class="icon">📋</span>
                <span class="label">Deck Plan</span>
            </a>
            {{/if}}
            {{#if cruiseInfo.cabin.stateroomUrl}}
            <a href="{{cruiseInfo.cabin.stateroomUrl}}" target="_blank" rel="noopener" class="quick-link stateroom">
                <span class="icon">🚪</span>
                <span class="label">Your Stateroom</span>
            </a>
            {{/if}}
        </div>

        <!-- Rest of cruise info... -->
    </div>
</div>
{{/if}}
```

**CSS:**
```css
.cruise-quick-links {
    display: flex;
    gap: 15px;
    margin: 20px 0;
    flex-wrap: wrap;
}

.quick-link {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 12px 20px;
    background: var(--primary);
    color: white;
    text-decoration: none;
    border-radius: 8px;
    font-weight: 600;
    transition: background 0.2s, transform 0.2s;
}

.quick-link:hover {
    background: var(--primary-dark);
    transform: translateY(-2px);
}

.quick-link .icon {
    font-size: 1.2em;
}

.quick-link.deck-plan {
    background: var(--accent);
}

.quick-link.deck-plan:hover {
    background: var(--accent-dark);
}
```

---

### Item 3: 12-Hour Time Format

**Add to `src/simple-template.ts`:**
```typescript
function formatTime(timeStr: string): string {
  if (!timeStr) return '';

  // Handle various input formats: "14:30", "1430", "2:30 PM"
  let hours: number, minutes: number;

  // Already in 12-hour format
  if (timeStr.toLowerCase().includes('am') || timeStr.toLowerCase().includes('pm')) {
    return timeStr;
  }

  // Parse 24-hour format
  const match = timeStr.match(/^(\d{1,2}):?(\d{2})$/);
  if (match) {
    hours = parseInt(match[1], 10);
    minutes = parseInt(match[2], 10);
  } else {
    return timeStr; // Return as-is if can't parse
  }

  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  const displayMinutes = minutes.toString().padStart(2, '0');

  return `${displayHours}:${displayMinutes} ${period}`;
}
```

**Register in helper resolution:**
```typescript
// In the helper resolution section of simple-template.ts
} else if (tagContent.startsWith('formatTime ')) {
  const arg = tagContent.slice(11).trim();
  const value = getValue(ctx, arg) ?? getValue(parentCtx, arg);
  result += formatTime(String(value || ''));
```

**Also add to `src/template-helpers.ts` for Handlebars:**
```typescript
Handlebars.registerHelper('formatTime', (timeStr: string) => {
  if (!timeStr) return '';

  if (timeStr.toLowerCase().includes('am') || timeStr.toLowerCase().includes('pm')) {
    return timeStr;
  }

  const match = timeStr.match(/^(\d{1,2}):?(\d{2})$/);
  if (match) {
    const hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  }

  return timeStr;
});
```

**Update template usages:**
Replace `{{port.arrival}}` with `{{formatTime port.arrival}}` throughout cruise.html

---

### Item 7: Provider Badges on Tours

**Current:** Priority badges like "Recommended", "High Priority"

**Change:** Show provider name instead: "Viator", "Celestyal Cruises", etc.

**Data requirement:** Each tour/excursion needs `provider` field:
```json
{
  "excursions": [
    {
      "name": "Athens Walking Tour",
      "provider": "Viator",
      "providerType": "viator"
    },
    {
      "name": "Ancient Ephesus Tour",
      "provider": "Celestyal Cruises",
      "providerType": "cruise-line"
    }
  ]
}
```

**Updated badge markup:**
```html
<div class="extra-card {{#if providerType}}provider-{{providerType}}{{/if}}">
    {{#if provider}}
    <span class="provider-badge {{providerType}}">{{provider}}</span>
    {{/if}}
    <!-- rest of card -->
</div>
```

**CSS:**
```css
.provider-badge {
    position: absolute;
    top: 12px;
    right: 12px;
    font-size: 0.7em;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 4px 10px;
    border-radius: 999px;
    font-weight: 600;
}

.provider-badge.viator {
    background: #FF5722;
    color: white;
}

.provider-badge.cruise-line {
    background: var(--primary);
    color: white;
}

.provider-badge.local {
    background: #4CAF50;
    color: white;
}
```

---

### Item 8: Functional Navigation Cards

**Current:** Overview cards are static display only (lines 1892-1932)

**Enhancement:** Make cards clickable, scrolling to relevant sections

**Updated overview cards:**
```html
<div class="overview-section">
    {{#if travelers.count}}
    <a href="#travel-party" class="overview-card clickable">
        <div class="icon">👥</div>
        <div class="label">Travelers</div>
        <div class="value">{{pluralize travelers.count "Guest" "Guests"}}</div>
    </a>
    {{/if}}

    {{#if cruiseInfo.nights}}
    <a href="#timeline" class="overview-card clickable">
        <div class="icon">🚢</div>
        <div class="label">Cruise</div>
        <div class="value">{{cruiseInfo.nights}} Nights</div>
    </a>
    {{/if}}

    {{#if meta.phase}}
    <a href="#your-cruise" class="overview-card clickable">
        <div class="icon">📋</div>
        <div class="label">Status</div>
        <div class="value">{{capitalize meta.phase}}</div>
    </a>
    {{/if}}

    {{#if budget.total}}
    <a href="#investment" class="overview-card clickable">
        <div class="icon">💰</div>
        <div class="label">Investment</div>
        <div class="value">{{formatCurrency budget.total}}</div>
    </a>
    {{/if}}
</div>
```

**CSS:**
```css
a.overview-card.clickable {
    text-decoration: none;
    color: inherit;
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s;
}

a.overview-card.clickable:hover {
    transform: translateY(-3px);
    box-shadow: 0 6px 20px rgba(27, 97, 156, 0.2);
}
```

**Add section IDs:** Ensure each target section has matching `id` attribute:
- `id="travel-party"` on Your Travel Party section
- `id="timeline"` on Day-by-Day / unified timeline section
- `id="your-cruise"` on Your Cruise section
- `id="investment"` on Investment Summary section

---

### Item 12: Travel Party Privacy Display

**Current:** May show full names and details

**Change:** Show first name + last initial, child/adult, document status indicators

**Data Schema:**
```json
{
  "travelers": {
    "count": 2,
    "details": [
      {
        "firstName": "Jane",
        "lastInitial": "D",
        "type": "adult",
        "hasPassport": true,
        "hasDOB": true,
        "hasID": true
      },
      {
        "firstName": "John",
        "lastInitial": "D",
        "type": "adult",
        "hasPassport": false,
        "hasDOB": true,
        "hasID": true
      }
    ]
  }
}
```

**Template markup:**
```html
<div class="section" id="travel-party">
    <div class="section-header">
        <div class="section-icon">👥</div>
        <h2>Your Travel Party</h2>
    </div>

    <div class="travelers-list">
        {{#each travelers.details}}
        <div class="traveler-card">
            <div class="traveler-name">
                {{firstName}} {{lastInitial}}.
                <span class="traveler-type {{type}}">{{capitalize type}}</span>
            </div>
            <div class="traveler-docs">
                <span class="doc-status {{#if hasPassport}}complete{{else}}pending{{/if}}" title="Passport">
                    🛂 {{#if hasPassport}}✓{{else}}Needed{{/if}}
                </span>
                <span class="doc-status {{#if hasDOB}}complete{{else}}pending{{/if}}" title="Date of Birth">
                    🎂 {{#if hasDOB}}✓{{else}}Needed{{/if}}
                </span>
                <span class="doc-status {{#if hasID}}complete{{else}}pending{{/if}}" title="Government ID">
                    🪪 {{#if hasID}}✓{{else}}Needed{{/if}}
                </span>
            </div>
        </div>
        {{/each}}
    </div>
</div>
```

**CSS:**
```css
.travelers-list {
    display: grid;
    gap: 15px;
}

.traveler-card {
    background: var(--white);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 15px 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
}

.traveler-name {
    font-weight: 600;
    font-size: 1.1em;
}

.traveler-type {
    font-size: 0.75em;
    padding: 3px 8px;
    border-radius: 12px;
    margin-left: 8px;
    font-weight: 500;
}

.traveler-type.adult {
    background: var(--bg-section);
    color: var(--primary);
}

.traveler-type.child {
    background: #fff3e0;
    color: #e65100;
}

.traveler-docs {
    display: flex;
    gap: 12px;
}

.doc-status {
    font-size: 0.85em;
    padding: 4px 8px;
    border-radius: 6px;
}

.doc-status.complete {
    background: #e8f5e9;
    color: #2e7d32;
}

.doc-status.pending {
    background: #fff3e0;
    color: #e65100;
}
```

---

### Item 16: Collapsible Maps

**Add collapse/expand functionality to maps section:**

```html
<div class="section collapsible" id="maps">
    <div class="section-header" onclick="toggleSection('maps-content')">
        <div class="section-icon">🗺️</div>
        <h2>Maps</h2>
        <span class="collapse-icon">▼</span>
    </div>
    <div id="maps-content" class="section-content collapsed">
        <!-- Map content -->
    </div>
</div>
```

**CSS:**
```css
.section.collapsible .section-header {
    cursor: pointer;
}

.section.collapsible .section-header:hover {
    background: var(--bg-light);
}

.collapse-icon {
    margin-left: auto;
    transition: transform 0.3s;
}

.section-content.collapsed {
    display: none;
}

.section-content.expanded {
    display: block;
}

.collapse-icon.rotated {
    transform: rotate(180deg);
}
```

**JavaScript (add to script section):**
```javascript
function toggleSection(contentId) {
    var content = document.getElementById(contentId);
    var header = content.previousElementSibling;
    var icon = header.querySelector('.collapse-icon');

    if (content.classList.contains('collapsed')) {
        content.classList.remove('collapsed');
        content.classList.add('expanded');
        icon.classList.add('rotated');
    } else {
        content.classList.add('collapsed');
        content.classList.remove('expanded');
        icon.classList.remove('rotated');
    }
}
```

---

### Item 17: Fix "Ask a Question" Footer

**Current issue (line 3505-3508):**
```html
<h4>Questions?</h4>
<p>
    Use the "Ask a question" buttons throughout this proposal, or<br>
</p>
```

The sentence is incomplete.

**Fix:**
```html
<h4>Questions?</h4>
<p>
    Use the "Ask a question" buttons throughout this proposal to send us a message, or
    {{#if _config.commentThreadUrl}}
    <a href="{{_config.commentThreadUrl}}">view the conversation</a>.
    {{else}}
    contact your travel advisor directly.
    {{/if}}
</p>
```

---

### Item 21: QR Code Browser Compatibility

**Current issue:** QR code uses external API that may be blocked or fail in some browsers

**Fix options:**

1. **Use a more reliable QR API:**
```javascript
// Use Google Charts API as fallback
var qrImg = document.getElementById('qr-code');
if (qrImg) {
    var primaryUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=' + url;
    var fallbackUrl = 'https://chart.googleapis.com/chart?cht=qr&chs=120x120&chl=' + url;

    qrImg.onerror = function() {
        this.onerror = null;
        this.src = fallbackUrl;
    };
    qrImg.src = primaryUrl;
}
```

2. **Generate QR code inline using JavaScript library:**
Add qrcode.js library or use a data URI approach.

3. **Ensure URL is correct:**
```javascript
// Fix: ensure we use the canonical page URL
var pageUrl = window.location.href.split('?')[0].split('#')[0];
var url = encodeURIComponent(pageUrl);
```

---

## Verification Checklist

- [ ] Travel insurance section renders with 3 options, mid-price recommended
- [ ] Deck plan and ship info links prominent and visible
- [ ] Times display in 12-hour format (e.g., "2:30 PM" not "14:30")
- [ ] Tour badges show provider name (Viator, cruise line name)
- [ ] Overview cards are clickable and scroll to sections
- [ ] Travel party shows first name + last initial only
- [ ] Document status indicators show (no actual PII)
- [ ] Maps section is collapsed by default, clicks to expand
- [ ] Footer "Questions?" text is complete with link
- [ ] QR code renders in Chrome, Safari, Firefox, Edge
- [ ] QR code links to current document URL

## Preview Command

```bash
curl -s -X POST "https://voygent.somotravel.workers.dev/sse?key=Kim.d63b7658" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"preview_publish","arguments":{"tripId":"greek-cruise-may-2026"}}}'
```
