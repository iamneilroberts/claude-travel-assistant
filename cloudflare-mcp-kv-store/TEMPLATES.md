# Voygent Template Guide

This document describes the required components for Voygent HTML templates. **When creating new templates, include ALL of these features.**

## Design Principles

1. **Maps and videos are REQUIRED** - Every trip should have contextual maps and videos
2. **Contextual placement** - Maps and videos appear inline with related content, not in separate sections
3. **AI-managed** - The AI decides which maps/videos to include based on the trip

## Required Template Components

### 1. Config Variables

Templates receive these computed values in `_config`:

```
{{_config.googleMapsApiKey}}  - Google Maps API key
{{_config.showMaps}}          - true unless meta.showMaps is false
{{_config.showVideos}}        - true unless meta.showVideos is false
```

### 2. Inline Maps (Contextual - REQUIRED)

Maps should appear **inline with the content they relate to**, not in a separate section.

#### In Lodging Section
```html
{{#if lodging}}
<div class="section">
    <div class="section-header">Accommodations</div>
    <div class="section-content">
        {{#each lodging}}
        <div class="lodging-item">
            <div class="card hotel-card">
                <h4>{{name}}</h4>
                <div class="card-detail"><span class="label">Location</span><span class="value">{{location}}</span></div>
                {{#if dates}}<div class="card-detail"><span class="label">Dates</span><span class="value">{{dates}}</span></div>{{/if}}
                {{#if rate}}<div class="card-detail"><span class="label">Rate</span><span class="value">{{formatCurrency rate}}/night</span></div>{{/if}}
                {{#if url}}<a href="{{url}}" class="card-link" target="_blank">View Hotel</a>{{/if}}
            </div>
            {{#if map}}
            <div class="inline-map">
                <div class="map-container">
                    <iframe loading="lazy" allowfullscreen referrerpolicy="no-referrer-when-downgrade"
                        src="https://www.google.com/maps/embed/v1/place?key={{_config.googleMapsApiKey}}&q={{encodeUri map}}">
                    </iframe>
                </div>
            </div>
            {{/if}}
        </div>
        {{/each}}
    </div>
</div>
{{/if}}
```

#### In Itinerary Section (with inline videos)
```html
{{#each itinerary}}
<div class="day-section">
    <div class="day-header">
        <div class="day-number">{{day}}</div>
        <div class="day-info">
            <h3>{{default title location}}</h3>
            {{#if date}}<div class="day-date">{{date}}</div>{{/if}}
        </div>
    </div>
    <div class="day-content">
        {{#each activities}}
        <div class="activity">
            <div class="activity-title">{{name}}</div>
            {{#if notes}}<div class="activity-details">{{notes}}</div>{{/if}}
        </div>
        {{/each}}
    </div>
    {{#if map}}
    <div class="inline-map" style="margin-top: 15px;">
        <div class="map-container">
            <iframe loading="lazy" allowfullscreen referrerpolicy="no-referrer-when-downgrade"
                src="https://www.google.com/maps/embed/v1/place?key={{_config.googleMapsApiKey}}&q={{encodeUri map}}">
            </iframe>
        </div>
    </div>
    {{/if}}
    {{#if videos}}
    <div class="inline-videos" style="margin-top: 15px;">
        <div class="video-grid">
        {{#each videos}}
            <div class="video-card">
                <div class="video-embed">
                    <iframe src="https://www.youtube.com/embed/{{id}}" allowfullscreen loading="lazy"></iframe>
                </div>
                {{#if caption}}<div class="video-caption">{{caption}}</div>{{/if}}
            </div>
        {{/each}}
        </div>
    </div>
    {{/if}}
</div>
{{/each}}
```

#### In Tours Section
```html
{{#if tours}}
<div class="section">
    <div class="section-header">Tours & Activities</div>
    <div class="section-content">
        {{#each tours}}
        <div class="tour-item" style="margin-bottom: 20px;">
            <div class="card">
                <h4>{{name}}</h4>
                {{#if date}}<div class="card-detail"><span class="label">Date</span><span class="value">{{date}}</span></div>{{/if}}
                {{#if time}}<div class="card-detail"><span class="label">Time</span><span class="value">{{time}}</span></div>{{/if}}
                {{#if duration}}<div class="card-detail"><span class="label">Duration</span><span class="value">{{duration}}</span></div>{{/if}}
                {{#if price}}<div class="card-detail"><span class="label">Price</span><span class="value">{{formatCurrency price}}</span></div>{{/if}}
                {{#if url}}<a href="{{url}}" class="card-link" target="_blank">Book Now</a>{{/if}}
            </div>
            {{#if map}}
            <div class="inline-map" style="margin-top: 10px;">
                <div class="map-container">
                    <iframe loading="lazy" allowfullscreen referrerpolicy="no-referrer-when-downgrade"
                        src="https://www.google.com/maps/embed/v1/place?key={{_config.googleMapsApiKey}}&q={{encodeUri map}}">
                    </iframe>
                </div>
            </div>
            {{/if}}
        </div>
        {{/each}}
    </div>
</div>
{{/if}}
```

### 3. General Maps Section (Overview/Fallback)

For destination overviews and general maps that don't fit inline:

```html
{{#if _config.showMaps}}
{{#if maps}}
<div class="section">
    <div class="section-header">Maps</div>
    <div class="section-content">
        {{#each maps}}
        <div class="map-item">
            {{#if label}}<h4 class="map-label">{{label}}</h4>{{/if}}
            <div class="map-container">
                <iframe loading="lazy" allowfullscreen referrerpolicy="no-referrer-when-downgrade"
                    src="https://www.google.com/maps/embed/v1/place?key={{_config.googleMapsApiKey}}&q={{encodeUri location}}">
                </iframe>
            </div>
        </div>
        {{/each}}
    </div>
</div>
{{else}}
{{#if meta.destination}}
<!-- Fallback: single destination map if no maps array and no inline maps -->
<div class="section">
    <div class="section-header">Destination Map</div>
    <div class="section-content">
        <div class="map-container">
            <iframe loading="lazy" allowfullscreen referrerpolicy="no-referrer-when-downgrade"
                src="https://www.google.com/maps/embed/v1/place?key={{_config.googleMapsApiKey}}&q={{encodeUri meta.destination}}">
            </iframe>
        </div>
    </div>
</div>
{{/if}}
{{/if}}
{{/if}}
```

### 4. General Videos Section (Overview)

For general destination videos that apply to the whole trip:

```html
{{#if _config.showVideos}}
{{#if media}}
<div class="section">
    <div class="section-header">Helpful Videos</div>
    <div class="section-content">
        <div class="video-grid">
        {{#each media}}
            <div class="video-card">
                <div class="video-embed">
                    <iframe src="https://www.youtube.com/embed/{{id}}" allowfullscreen loading="lazy"></iframe>
                </div>
                {{#if caption}}<div class="video-caption">{{caption}}</div>{{/if}}
            </div>
        {{/each}}
        </div>
    </div>
</div>
{{/if}}
{{/if}}
```

### 5. Required CSS for Maps and Videos

```css
/* Map containers */
.map-item { margin-bottom: 20px; }
.map-item:last-child { margin-bottom: 0; }
.map-label { margin: 0 0 10px 0; font-size: 1em; }
.map-container { border-radius: 8px; overflow: hidden; border: 1px solid #ddd; }
.map-container iframe { width: 100%; height: 300px; border: none; }

/* Inline maps and videos (contextual) */
.lodging-item { margin-bottom: 25px; }
.lodging-item:last-child { margin-bottom: 0; }
.inline-map { margin-top: 10px; }
.inline-map .map-container iframe { height: 250px; }
.inline-videos .video-grid { grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); }

/* Video grid */
.video-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
.video-card { background: white; border: 1px solid #ddd; border-radius: 8px; overflow: hidden; }
.video-embed { position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; }
.video-embed iframe { position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none; }
.video-caption { padding: 12px 15px; font-size: 0.95em; }
```

### 6. Tiered Pricing Section

```html
{{#if tiers}}
<div class="section">
    <div class="section-header">Package Options</div>
    <div class="section-content">
        <div class="tiers-grid">
            {{#if tiers.value}}
            <div class="tier-card">
                <div class="tier-header">
                    <div class="tier-name">{{tiers.value.name}}</div>
                    <div class="tier-desc">{{tiers.value.description}}</div>
                </div>
                <div class="tier-details">
                    {{#if tiers.value.lodging}}<p><strong>Lodging:</strong> {{#each tiers.value.lodging}}{{name}}{{/each}}</p>{{/if}}
                    {{#if tiers.value.flights}}<p><strong>Flights:</strong> {{tiers.value.flights.class}}</p>{{/if}}
                    {{#if tiers.value.extras}}<p><strong>Includes:</strong> {{tiers.value.extras}}</p>{{/if}}
                </div>
                <div class="tier-price">
                    <div class="total">{{formatCurrency tiers.value.estimatedTotal}}</div>
                    {{#if tiers.value.perPerson}}<div class="per-person">{{formatCurrency tiers.value.perPerson}} per person</div>{{/if}}
                </div>
            </div>
            {{/if}}
            {{#if tiers.premium}}
            <div class="tier-card recommended">
                <div class="tier-badge">Recommended</div>
                <!-- Same structure as value tier -->
            </div>
            {{/if}}
            {{#if tiers.luxury}}
            <div class="tier-card">
                <!-- Same structure as value tier -->
            </div>
            {{/if}}
        </div>
    </div>
</div>
{{/if}}
```

### 7. QR Code Footer

```html
<div class="footer">
    <div class="qr-section">
        <p>Scan to view on mobile</p>
        <img id="qr-code" alt="QR Code" style="width: 120px; height: 120px;">
    </div>
    <p>Generated {{formatDate meta.lastUpdated}}</p>
    <p>Template: [template-name] v[version] | Rendered: {{timestamp}}</p>
</div>
<script>
    (function() {
        var url = encodeURIComponent(window.location.href);
        var qrImg = document.getElementById('qr-code');
        if (qrImg) {
            qrImg.src = 'https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=' + url;
        }
    })();
</script>
```

## Data Schema for Maps and Videos

### Inline Maps (in data items)
```json
{
  "lodging": [
    { "name": "Hotel Name", "location": "City", "map": "Hotel Name, Full Address, City" }
  ],
  "itinerary": [
    { "day": 1, "title": "Day Title", "map": "Area or attraction name" }
  ],
  "tours": [
    { "name": "Tour Name", "map": "Meeting point address" }
  ]
}
```

### Inline Videos (in itinerary)
```json
{
  "itinerary": [
    {
      "day": 1,
      "title": "Snorkeling Day",
      "videos": [
        { "id": "youtubeVideoId", "caption": "What to expect snorkeling here" }
      ]
    }
  ]
}
```

### General Maps (overview section)
```json
{
  "maps": [
    { "location": "Destination, Country", "label": "Destination Overview" }
  ]
}
```

### General Videos (overview section)
```json
{
  "media": [
    { "id": "youtubeVideoId", "caption": "First time visiting? Watch this" }
  ]
}
```

## Standard Sections

Every template should include these sections (render if data exists):

| Section | Data Source | Inline Maps/Videos |
|---------|-------------|-------------------|
| Header | `meta.clientName`, `meta.destination`, `meta.dates` | - |
| Overview | `travelers.count`, `dates`, `budget` | - |
| General Maps | `maps[]` or `meta.destination` fallback | Overview maps |
| Travelers | `travelers.names`, `travelers.notes` | - |
| Preferences | `preferences.vibe`, `mustHave`, `avoid` | - |
| Flights | `flights.outbound`, `flights.return` | - |
| Lodging | `lodging[]` | **Inline map per hotel** |
| Itinerary | `itinerary[]` | **Inline map + videos per day** |
| Tours | `tours[]` | **Inline map per tour** |
| Dining | `dining[]` | - |
| General Videos | `media[]` | Overview videos |
| Tiers | `tiers.value/premium/luxury` | - |
| Footer | QR code, version, timestamp | - |

## Template Helpers

| Helper | Usage | Output |
|--------|-------|--------|
| `{{formatCurrency amount}}` | `{{formatCurrency 2500}}` | `$2,500` |
| `{{formatDate dateStr}}` | `{{formatDate "2026-10-15"}}` | `October 15, 2026` |
| `{{capitalize str}}` | `{{capitalize "pending"}}` | `Pending` |
| `{{default path "fallback"}}` | `{{default title location}}` | Value or fallback |
| `{{encodeUri path}}` | `{{encodeUri map}}` | URL-encoded string |
| `{{timestamp}}` | `{{timestamp}}` | Current UTC datetime |
| `{{pluralize n "item" "items"}}` | `{{pluralize 3 "day" "days"}}` | `3 days` |

## Creating a New Template

1. Start with `default-template.ts` as reference
2. **MUST include inline maps** in lodging, itinerary, and tours sections
3. **MUST include inline videos** in itinerary sections
4. Include general maps/videos sections for overview content
5. Customize branding (colors, logo, fonts)
6. Test with a trip that has all data types
7. Upload to KV: `wrangler kv:key put "_templates/[name]" --path=[file] --namespace-id=aa119fcdabfe40858f1ce46a5fbf4563`

## Version Tracking

Include version in footer for cache debugging:
```
Template: [name] v[major].[minor] | Rendered: {{timestamp}}
```
