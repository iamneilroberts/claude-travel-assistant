/**
 * Default Handlebars template for trip proposals
 */
export const DEFAULT_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{meta.clientName}} - {{meta.destination}}</title>
    <style>
        :root {
            --primary: #2c5f2d;
            --primary-light: #4a7c4b;
            --secondary: #97bc62;
            --accent: #4a90e2;
            --bg-light: #f8f9fa;
            --bg-highlight: #f0f7f0;
            --text: #333;
            --text-light: #666;
            --border: #dee2e6;
            --shadow: 0 2px 8px rgba(0,0,0,0.1);
            --radius: 8px;
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: var(--text);
            background: #fff;
            max-width: 900px;
            margin: 0 auto;
            padding: 20px;
        }

        .header {
            text-align: center;
            padding: 30px 20px;
            background: linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%);
            color: white;
            border-radius: var(--radius);
            margin-bottom: 30px;
        }

        .header h1 { font-size: 2em; margin-bottom: 10px; }
        .header .subtitle { font-size: 1.2em; opacity: 0.9; }
        .header .dates {
            margin-top: 15px;
            font-size: 1.1em;
            background: rgba(255,255,255,0.2);
            padding: 8px 20px;
            border-radius: 20px;
            display: inline-block;
        }

        .overview-box {
            background: var(--bg-highlight);
            border: 2px solid var(--secondary);
            border-radius: var(--radius);
            padding: 20px;
            margin-bottom: 30px;
        }

        .overview-box h2 { color: var(--primary); margin-bottom: 15px; font-size: 1.3em; }

        .overview-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
        }

        .overview-item {
            background: white;
            padding: 12px;
            border-radius: var(--radius);
            border-left: 4px solid var(--primary);
        }

        .overview-item .label {
            font-size: 0.85em;
            color: var(--text-light);
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .overview-item .value { font-size: 1.1em; font-weight: 600; color: var(--primary); }

        .section { margin-bottom: 30px; }

        .section-header {
            background: var(--primary);
            color: white;
            padding: 12px 20px;
            border-radius: var(--radius) var(--radius) 0 0;
            font-size: 1.2em;
            font-weight: 600;
        }

        .section-content {
            border: 1px solid var(--border);
            border-top: none;
            border-radius: 0 0 var(--radius) var(--radius);
            padding: 20px;
            background: white;
        }

        .day-section {
            margin-bottom: 25px;
            border: 1px solid var(--border);
            border-radius: var(--radius);
            overflow: hidden;
        }

        .day-header {
            background: var(--bg-light);
            padding: 15px 20px;
            display: flex;
            align-items: center;
            gap: 15px;
            border-bottom: 1px solid var(--border);
        }

        .day-number {
            background: var(--primary);
            color: white;
            width: 50px;
            height: 50px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 1.2em;
        }

        .day-info h3 { color: var(--primary); margin-bottom: 2px; }
        .day-date { color: var(--text-light); font-size: 0.9em; }
        .day-content { padding: 20px; }

        .activity {
            padding: 12px;
            margin-bottom: 10px;
            background: var(--bg-light);
            border-radius: var(--radius);
            border-left: 4px solid var(--accent);
        }

        .activity:last-child { margin-bottom: 0; }
        .activity-title { font-weight: 600; margin-bottom: 5px; }
        .activity-details { font-size: 0.95em; color: var(--text-light); }

        .cards-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 20px;
        }

        .card {
            background: white;
            border: 1px solid var(--border);
            border-radius: var(--radius);
            padding: 20px;
            box-shadow: var(--shadow);
        }

        .card h4 { color: var(--primary); margin-bottom: 10px; font-size: 1.1em; }

        .card-detail {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid var(--border);
            font-size: 0.95em;
        }

        .card-detail:last-child { border-bottom: none; }
        .card-detail .label { color: var(--text-light); }
        .card-detail .value { font-weight: 500; }

        .card-link {
            display: inline-block;
            margin-top: 10px;
            color: var(--accent);
            text-decoration: none;
        }

        .card-link:hover { text-decoration: underline; }

        .flight-card {
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            border-left: 4px solid var(--accent);
        }

        .flight-route { font-size: 1.2em; font-weight: 600; color: var(--primary); }
        .hotel-card { border-left: 4px solid var(--secondary); }

        .pricing-box {
            background: var(--bg-highlight);
            border: 2px solid var(--primary);
            border-radius: var(--radius);
            padding: 25px;
        }

        .pricing-row {
            display: flex;
            justify-content: space-between;
            padding: 10px 0;
            border-bottom: 1px solid var(--border);
        }

        .pricing-row:last-child { border-bottom: none; }

        .pricing-row.total {
            font-size: 1.3em;
            font-weight: 700;
            color: var(--primary);
            border-top: 2px solid var(--primary);
            margin-top: 10px;
            padding-top: 15px;
        }

        .notes-box {
            background: #fff3cd;
            border: 1px solid #ffc107;
            border-radius: var(--radius);
            padding: 15px;
            margin-top: 15px;
        }

        .notes-box h4 { color: #856404; margin-bottom: 10px; }
        ul { margin-left: 20px; }
        li { margin-bottom: 5px; }

        .badge {
            display: inline-block;
            padding: 4px 10px;
            border-radius: 12px;
            font-size: 0.85em;
            font-weight: 500;
        }

        .badge-confirmed { background: #d4edda; color: #155724; }
        .badge-pending { background: #fff3cd; color: #856404; }
        .badge-phase { background: var(--primary); color: white; }

        /* Video Embeds */
        .video-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
        }

        .video-card {
            background: white;
            border: 1px solid var(--border);
            border-radius: var(--radius);
            overflow: hidden;
        }

        .video-embed {
            position: relative;
            padding-bottom: 56.25%; /* 16:9 aspect ratio */
            height: 0;
            overflow: hidden;
        }

        .video-embed iframe {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            border: none;
        }

        .video-caption {
            padding: 12px 15px;
            font-size: 0.95em;
            color: var(--text);
            background: var(--bg-light);
        }

        /* Map Section */
        .map-item {
            margin-bottom: 20px;
        }
        .map-item:last-child {
            margin-bottom: 0;
        }
        .map-label {
            margin: 0 0 10px 0;
            font-size: 1em;
            color: var(--text);
        }
        .map-container {
            border-radius: var(--radius);
            overflow: hidden;
            border: 1px solid var(--border);
        }

        .map-container iframe {
            width: 100%;
            height: 300px;
            border: none;
        }

        /* Inline maps and videos (contextual) */
        .lodging-item {
            margin-bottom: 25px;
        }
        .lodging-item:last-child {
            margin-bottom: 0;
        }
        .inline-map {
            margin-top: 10px;
        }
        .inline-map .map-container iframe {
            height: 250px;
        }
        .inline-videos .video-grid {
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        }

        .footer {
            text-align: center;
            padding: 30px;
            color: var(--text-light);
            font-size: 0.9em;
            border-top: 1px solid var(--border);
            margin-top: 40px;
        }

        .footer .brand { font-weight: 600; color: var(--primary); }

        @media (max-width: 600px) {
            body { padding: 10px; }
            .header h1 { font-size: 1.5em; }
            .overview-grid, .cards-grid { grid-template-columns: 1fr; }
        }

        @media print {
            body { max-width: none; padding: 0; }
            .header { background: var(--primary) !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }

        /* Image Gallery */
        .hero-gallery {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 15px;
            margin-bottom: 30px;
        }

        .hero-gallery.single-image {
            grid-template-columns: 1fr;
            max-width: 800px;
            margin-left: auto;
            margin-right: auto;
        }

        .gallery-image {
            border-radius: var(--radius);
            overflow: hidden;
            box-shadow: var(--shadow);
        }

        .gallery-image img {
            width: 100%;
            height: 200px;
            object-fit: cover;
            display: block;
            transition: transform 0.3s;
        }

        .hero-gallery.single-image .gallery-image img {
            height: 350px;
        }

        .gallery-image:hover img {
            transform: scale(1.02);
        }

        .gallery-image .caption {
            padding: 8px 12px;
            font-size: 0.85em;
            color: var(--text-light);
            background: var(--bg-light);
        }

        .inline-gallery {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 10px;
            margin-top: 15px;
        }

        .inline-gallery .gallery-image img {
            height: 120px;
        }

        .inline-gallery .gallery-image .caption {
            padding: 6px 8px;
            font-size: 0.8em;
        }

        /* Tiered Pricing Comparison */
        .tiers-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 20px;
        }

        .tier-card {
            border: 2px solid var(--border);
            border-radius: var(--radius);
            overflow: hidden;
            background: white;
            transition: transform 0.2s, box-shadow 0.2s;
        }

        .tier-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 8px 24px rgba(0,0,0,0.12);
        }

        .tier-card.recommended {
            border-color: var(--primary);
            box-shadow: 0 4px 16px rgba(44, 95, 45, 0.2);
        }

        .tier-header {
            padding: 20px;
            text-align: center;
            background: var(--bg-light);
            border-bottom: 1px solid var(--border);
        }

        .tier-card.recommended .tier-header {
            background: var(--primary);
            color: white;
        }

        .tier-name {
            font-size: 1.3em;
            font-weight: 700;
            margin-bottom: 5px;
        }

        .tier-description {
            font-size: 0.9em;
            color: var(--text-light);
        }

        .tier-card.recommended .tier-description {
            color: rgba(255,255,255,0.85);
        }

        .tier-price {
            padding: 20px;
            text-align: center;
            background: var(--bg-highlight);
        }

        .tier-price .total {
            font-size: 2em;
            font-weight: 700;
            color: var(--primary);
        }

        .tier-price .per-person {
            font-size: 0.95em;
            color: var(--text-light);
            margin-top: 5px;
        }

        .tier-details {
            padding: 20px;
        }

        .tier-details h5 {
            font-size: 0.85em;
            text-transform: uppercase;
            color: var(--text-light);
            margin-bottom: 10px;
            letter-spacing: 0.5px;
        }

        .tier-item {
            display: flex;
            align-items: flex-start;
            gap: 10px;
            padding: 8px 0;
            border-bottom: 1px solid var(--border);
            font-size: 0.95em;
        }

        .tier-item:last-child { border-bottom: none; }

        .tier-item .check {
            color: var(--secondary);
            font-weight: bold;
        }

        .tier-badge {
            display: inline-block;
            background: var(--primary);
            color: white;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 0.75em;
            font-weight: 600;
            margin-left: 10px;
        }

        /* Mobile: Stack tiers vertically with compact layout */
        @media (max-width: 800px) {
            .tiers-grid {
                grid-template-columns: 1fr;
                gap: 15px;
            }

            .tier-card {
                display: grid;
                grid-template-columns: 1fr auto;
                grid-template-rows: auto auto;
            }

            .tier-header {
                grid-column: 1 / -1;
                padding: 15px;
            }

            .tier-price {
                display: flex;
                flex-direction: column;
                justify-content: center;
                padding: 15px 20px;
                border-left: 1px solid var(--border);
            }

            .tier-price .total {
                font-size: 1.5em;
            }

            .tier-details {
                padding: 15px;
                grid-column: 1;
                grid-row: 2;
            }

            .tier-card.recommended {
                order: -1; /* Show recommended first on mobile */
            }
        }

        /* Very small screens: Full stack */
        @media (max-width: 480px) {
            .tier-card {
                display: block;
            }

            .tier-price {
                border-left: none;
                border-top: 1px solid var(--border);
            }

            .tier-name { font-size: 1.1em; }
            .tier-price .total { font-size: 1.4em; }
        }

        /* Comment buttons and modal */
        .comment-btn {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            padding: 6px 12px;
            font-size: 0.85em;
            color: var(--text-light);
            background: transparent;
            border: 1px solid var(--border);
            border-radius: 20px;
            cursor: pointer;
            transition: all 0.2s;
        }
        .comment-btn:hover {
            background: var(--bg-light);
            color: var(--primary);
            border-color: var(--primary);
        }
        .section-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .comment-modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            z-index: 1000;
            justify-content: center;
            align-items: center;
        }
        .comment-modal.active { display: flex; }
        .comment-form {
            background: white;
            padding: 25px;
            border-radius: var(--radius);
            width: 90%;
            max-width: 500px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
        }
        .comment-form h3 {
            margin-bottom: 15px;
            color: var(--primary);
        }
        .comment-form input,
        .comment-form textarea {
            width: 100%;
            padding: 10px;
            margin-bottom: 15px;
            border: 1px solid var(--border);
            border-radius: var(--radius);
            font-size: 1em;
        }
        .comment-form textarea {
            min-height: 100px;
            resize: vertical;
        }
        .comment-form-buttons {
            display: flex;
            gap: 10px;
            justify-content: flex-end;
        }
        .comment-form button {
            padding: 10px 20px;
            border-radius: var(--radius);
            font-size: 1em;
            cursor: pointer;
        }
        .comment-form .cancel-btn {
            background: var(--bg-light);
            border: 1px solid var(--border);
            color: var(--text);
        }
        .comment-form .submit-btn {
            background: var(--primary);
            border: none;
            color: white;
        }
        .comment-form .submit-btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }
        .comment-success {
            text-align: center;
            padding: 20px;
            color: var(--primary);
        }

        /* Reserve Now button */
        .reserve-btn {
            display: block;
            width: 100%;
            padding: 18px 30px;
            background: linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%);
            color: white;
            text-align: center;
            text-decoration: none;
            font-size: 1.2em;
            font-weight: 600;
            border-radius: var(--radius);
            margin: 30px 0;
            box-shadow: var(--shadow);
            transition: transform 0.2s, box-shadow 0.2s;
        }
        .reserve-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        }
        .reserve-section {
            text-align: center;
            margin: 30px 0;
        }
        .reserve-section p {
            color: var(--text-light);
            margin-bottom: 15px;
        }

        /* General comment button */
        .general-comment {
            text-align: center;
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>{{meta.clientName}}</h1>
        <div class="subtitle">{{meta.destination}}</div>
        {{#if meta.dates}}<div class="dates">{{meta.dates}}</div>{{/if}}
    </div>

    {{#if images.hero}}
    <div class="hero-gallery{{#if images.hero.length}}{{#unless images.hero.[1]}} single-image{{/unless}}{{/if}}">
        {{#each images.hero}}
        <div class="gallery-image">
            <img src="{{urls.medium}}" alt="{{default caption 'Trip photo'}}" loading="lazy">
            {{#if caption}}<div class="caption">{{caption}}</div>{{/if}}
        </div>
        {{/each}}
    </div>
    {{/if}}

    <div class="overview-box">
        <h2>Trip Overview</h2>
        <div class="overview-grid">
            {{#if travelers.count}}
            <div class="overview-item">
                <div class="label">Travelers</div>
                <div class="value">{{pluralize travelers.count "person" "people"}}</div>
            </div>
            {{/if}}
            {{#if dates.duration}}
            <div class="overview-item">
                <div class="label">Duration</div>
                <div class="value">{{dates.duration}} days</div>
            </div>
            {{/if}}
            {{#if meta.phase}}
            <div class="overview-item">
                <div class="label">Status</div>
                <div class="value"><span class="badge badge-phase">{{capitalize meta.phase}}</span></div>
            </div>
            {{/if}}
            {{#if budget.total}}
            <div class="overview-item">
                <div class="label">Estimated Budget</div>
                <div class="value">{{formatCurrency budget.total}}</div>
            </div>
            {{/if}}
        </div>
    </div>

    {{#if _config.showMaps}}
    {{#if maps}}
    <div class="section">
        <div class="section-header">Maps</div>
        <div class="section-content">
            {{#each maps}}
            <div class="map-item">
                {{#if label}}<h4 class="map-label">{{label}}</h4>{{/if}}
                <div class="map-container">
                    <iframe
                        loading="lazy"
                        allowfullscreen
                        referrerpolicy="no-referrer-when-downgrade"
                        src="https://www.google.com/maps/embed/v1/place?key={{_config.googleMapsApiKey}}&q={{encodeUri location}}">
                    </iframe>
                </div>
            </div>
            {{/each}}
        </div>
    </div>
    {{else}}
    {{#if meta.destination}}
    <div class="section">
        <div class="section-header">Destination Map</div>
        <div class="section-content">
            <div class="map-container">
                <iframe
                    loading="lazy"
                    allowfullscreen
                    referrerpolicy="no-referrer-when-downgrade"
                    src="https://www.google.com/maps/embed/v1/place?key={{_config.googleMapsApiKey}}&q={{encodeUri meta.destination}}">
                </iframe>
            </div>
        </div>
    </div>
    {{/if}}
    {{/if}}
    {{/if}}

    {{#if travelers.names}}
    <div class="section">
        <div class="section-header">Travelers</div>
        <div class="section-content">
            <ul>
            {{#each travelers.names}}<li>{{this}}</li>{{/each}}
            </ul>
            {{#if travelers.notes}}
            <div class="notes-box"><h4>Notes</h4><p>{{travelers.notes}}</p></div>
            {{/if}}
        </div>
    </div>
    {{/if}}

    {{#if preferences}}
    <div class="section">
        <div class="section-header">Trip Preferences</div>
        <div class="section-content">
            {{#if preferences.vibe}}<p><strong>Vibe:</strong> {{preferences.vibe}}</p>{{/if}}
            {{#if preferences.mustHave}}
            <h4 style="margin-top: 15px;">Must-Haves</h4>
            <ul>{{#each preferences.mustHave}}<li>{{this}}</li>{{/each}}</ul>
            {{/if}}
            {{#if preferences.avoid}}
            <h4 style="margin-top: 15px;">Avoid</h4>
            <ul>{{#each preferences.avoid}}<li>{{this}}</li>{{/each}}</ul>
            {{/if}}
        </div>
    </div>
    {{/if}}

    {{#if flights}}
    <div class="section">
        <div class="section-header"><span>Flights</span><button class="comment-btn" onclick="openComment('flights', 'Flights')">💬 Comment</button></div>
        <div class="section-content">
            <div class="cards-grid">
                {{#if flights.outbound}}
                <div class="card flight-card">
                    <h4>Outbound Flight</h4>
                    <div class="flight-route">{{flights.outbound.route}}</div>
                    <div class="card-detail"><span class="label">Date</span><span class="value">{{flights.outbound.date}}</span></div>
                    <div class="card-detail"><span class="label">Airline</span><span class="value">{{default flights.outbound.airline "TBD"}}</span></div>
                    {{#if flights.outbound.notes}}<p style="margin-top: 10px; font-size: 0.9em; color: var(--text-light);">{{flights.outbound.notes}}</p>{{/if}}
                </div>
                {{/if}}
                {{#if flights.return}}
                <div class="card flight-card">
                    <h4>Return Flight</h4>
                    <div class="flight-route">{{flights.return.route}}</div>
                    <div class="card-detail"><span class="label">Date</span><span class="value">{{flights.return.date}}</span></div>
                    <div class="card-detail"><span class="label">Airline</span><span class="value">{{default flights.return.airline "TBD"}}</span></div>
                </div>
                {{/if}}
            </div>
            {{#if flights.estimatedTotal}}
            <div class="notes-box" style="background: #e7f3ff; border-color: var(--accent);">
                <h4 style="color: var(--accent);">Estimated Cost</h4>
                <p>{{flights.estimatedTotal.range}} {{#if flights.estimatedTotal.notes}}- {{flights.estimatedTotal.notes}}{{/if}}</p>
            </div>
            {{/if}}
        </div>
    </div>
    {{/if}}

    {{#if lodging}}
    <div class="section">
        <div class="section-header"><span>Accommodations</span><button class="comment-btn" onclick="openComment('lodging', 'Accommodations')">💬 Comment</button></div>
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
                {{#with (lookup ../images.lodging name)}}
                <div class="inline-gallery">
                    {{#each this}}
                    <div class="gallery-image">
                        <img src="{{urls.thumbnail}}" alt="{{default caption ../name}}" loading="lazy" onclick="window.open('{{urls.large}}', '_blank')">
                        {{#if caption}}<div class="caption">{{caption}}</div>{{/if}}
                    </div>
                    {{/each}}
                </div>
                {{/with}}
            </div>
            {{/each}}
        </div>
    </div>
    {{/if}}

    {{#if narrowboat}}
    <div class="section">
        <div class="section-header">Narrowboat Details</div>
        <div class="section-content">
            <div class="overview-grid">
                <div class="overview-item"><div class="label">Duration</div><div class="value">{{narrowboat.duration}}</div></div>
                {{#if narrowboat.requirements.cabins}}<div class="overview-item"><div class="label">Cabins</div><div class="value">{{narrowboat.requirements.cabins}}</div></div>{{/if}}
                {{#if narrowboat.requirements.bathrooms}}<div class="overview-item"><div class="label">Bathrooms</div><div class="value">{{narrowboat.requirements.bathrooms}}</div></div>{{/if}}
            </div>
            {{#if narrowboat.recommendedCompanies}}
            <h4 style="margin-top: 20px; margin-bottom: 15px;">Recommended Companies</h4>
            <div class="cards-grid">
            {{#each narrowboat.recommendedCompanies}}
                <div class="card">
                    <h4>{{name}}</h4>
                    {{#if notes}}<p style="font-size: 0.9em; margin-bottom: 10px;">{{notes}}</p>{{/if}}
                    {{#if trainAccess}}<div class="card-detail"><span class="label">Train Access</span><span class="value">{{trainAccess}}</span></div>{{/if}}
                    {{#if phone}}<div class="card-detail"><span class="label">Phone</span><span class="value">{{phone}}</span></div>{{/if}}
                    {{#if url}}<a href="{{url}}" class="card-link" target="_blank">Visit Website</a>{{/if}}
                </div>
            {{/each}}
            </div>
            {{/if}}
            {{#if narrowboat.estimatedCost}}
            <div class="notes-box" style="background: #e7f3ff; border-color: var(--accent); margin-top: 20px;">
                <h4 style="color: var(--accent);">Estimated Cost</h4>
                <p>{{narrowboat.estimatedCost.range}} {{#if narrowboat.estimatedCost.notes}}- {{narrowboat.estimatedCost.notes}}{{/if}}</p>
            </div>
            {{/if}}
        </div>
    </div>
    {{/if}}

    {{#if itinerary}}
    <div class="section">
        <div class="section-header"><span>Day-by-Day Itinerary</span><button class="comment-btn" onclick="openComment('itinerary', 'Itinerary')">💬 Comment</button></div>
        <div class="section-content">
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
                        {{#if url}}<a href="{{url}}" class="card-link" target="_blank">More Info</a>{{/if}}
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
                {{#with (lookup ../images.days day)}}
                <div class="inline-gallery" style="margin-top: 15px;">
                    {{#each this}}
                    <div class="gallery-image">
                        <img src="{{urls.thumbnail}}" alt="{{default caption 'Day photo'}}" loading="lazy" onclick="window.open('{{urls.large}}', '_blank')">
                        {{#if caption}}<div class="caption">{{caption}}</div>{{/if}}
                    </div>
                    {{/each}}
                </div>
                {{/with}}
            </div>
            {{/each}}
        </div>
    </div>
    {{/if}}

    {{#if tours}}
    <div class="section">
        <div class="section-header"><span>Tours & Activities</span><button class="comment-btn" onclick="openComment('tours', 'Tours')">💬 Comment</button></div>
        <div class="section-content">
            {{#each tours}}
            <div class="tour-item" style="margin-bottom: 20px;">
                <div class="card">
                    <h4>{{name}}</h4>
                    {{#if date}}<div class="card-detail"><span class="label">Date</span><span class="value">{{date}}</span></div>{{/if}}
                    {{#if time}}<div class="card-detail"><span class="label">Time</span><span class="value">{{time}}</span></div>{{/if}}
                    {{#if duration}}<div class="card-detail"><span class="label">Duration</span><span class="value">{{duration}}</span></div>{{/if}}
                    {{#if price}}<div class="card-detail"><span class="label">Price</span><span class="value">{{formatCurrency price}}</span></div>{{/if}}
                    {{#if notes}}<p style="margin-top: 10px; color: var(--text-light);">{{notes}}</p>{{/if}}
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

    {{#if extras}}
    <div class="section">
        <div class="section-header">Special Recommendations</div>
        <div class="section-content">
            {{#if extras.hiddenGem}}
            <div class="card" style="margin-bottom: 15px; border-left: 4px solid #ffc107;">
                <h4>Hidden Gem: {{extras.hiddenGem.name}}</h4>
                <p>{{extras.hiddenGem.why}}</p>
                {{#if extras.hiddenGem.howToDoIt}}<p style="margin-top: 10px;"><strong>How:</strong> {{extras.hiddenGem.howToDoIt}}</p>{{/if}}
                {{#if extras.hiddenGem.url}}<a href="{{extras.hiddenGem.url}}" class="card-link" target="_blank">Learn More</a>{{/if}}
            </div>
            {{/if}}
            {{#if extras.waterFeaturePhotoOp}}
            <div class="card" style="border-left: 4px solid var(--accent);">
                <h4>Photo Op: {{extras.waterFeaturePhotoOp.name}}</h4>
                <p>{{extras.waterFeaturePhotoOp.why}}</p>
                {{#if extras.waterFeaturePhotoOp.howToDoIt}}<p style="margin-top: 10px;"><strong>How:</strong> {{extras.waterFeaturePhotoOp.howToDoIt}}</p>{{/if}}
            </div>
            {{/if}}
        </div>
    </div>
    {{/if}}

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

    {{#if tiers}}
    <div class="section">
        <div class="section-header"><span>Package Options</span><button class="comment-btn" onclick="openComment('tiers', 'Package Options')">💬 Comment</button></div>
        <div class="section-content">
            <div class="tiers-grid">
                {{#if tiers.value}}
                <div class="tier-card">
                    <div class="tier-header">
                        <div class="tier-name">{{default tiers.value.name "Essential"}}</div>
                        <div class="tier-description">{{tiers.value.description}}</div>
                    </div>
                    <div class="tier-price">
                        <div class="total">{{formatCurrency tiers.value.estimatedTotal}}</div>
                        {{#if tiers.value.perPerson}}<div class="per-person">{{formatCurrency tiers.value.perPerson}} per person</div>{{/if}}
                    </div>
                    <div class="tier-details">
                        {{#if tiers.value.flights}}<div class="tier-item"><span class="check">✓</span><span>{{tiers.value.flights.class}} Class Flights</span></div>{{/if}}
                        {{#each tiers.value.lodging}}<div class="tier-item"><span class="check">✓</span><span>{{name}}{{#if rate}} - {{formatCurrency rate}}/night{{/if}}</span></div>{{/each}}
                        {{#each tiers.value.includes}}<div class="tier-item"><span class="check">✓</span><span>{{this}}</span></div>{{/each}}
                    </div>
                </div>
                {{/if}}

                {{#if tiers.premium}}
                <div class="tier-card recommended">
                    <div class="tier-header">
                        <div class="tier-name">{{default tiers.premium.name "Enhanced"}}<span class="tier-badge">RECOMMENDED</span></div>
                        <div class="tier-description">{{tiers.premium.description}}</div>
                    </div>
                    <div class="tier-price">
                        <div class="total">{{formatCurrency tiers.premium.estimatedTotal}}</div>
                        {{#if tiers.premium.perPerson}}<div class="per-person">{{formatCurrency tiers.premium.perPerson}} per person</div>{{/if}}
                    </div>
                    <div class="tier-details">
                        {{#if tiers.premium.flights}}<div class="tier-item"><span class="check">✓</span><span>{{tiers.premium.flights.class}} Class Flights</span></div>{{/if}}
                        {{#each tiers.premium.lodging}}<div class="tier-item"><span class="check">✓</span><span>{{name}}{{#if rate}} - {{formatCurrency rate}}/night{{/if}}</span></div>{{/each}}
                        {{#each tiers.premium.includes}}<div class="tier-item"><span class="check">✓</span><span>{{this}}</span></div>{{/each}}
                    </div>
                </div>
                {{/if}}

                {{#if tiers.luxury}}
                <div class="tier-card">
                    <div class="tier-header">
                        <div class="tier-name">{{default tiers.luxury.name "Ultimate"}}</div>
                        <div class="tier-description">{{tiers.luxury.description}}</div>
                    </div>
                    <div class="tier-price">
                        <div class="total">{{formatCurrency tiers.luxury.estimatedTotal}}</div>
                        {{#if tiers.luxury.perPerson}}<div class="per-person">{{formatCurrency tiers.luxury.perPerson}} per person</div>{{/if}}
                    </div>
                    <div class="tier-details">
                        {{#if tiers.luxury.flights}}<div class="tier-item"><span class="check">✓</span><span>{{tiers.luxury.flights.class}} Class Flights</span></div>{{/if}}
                        {{#each tiers.luxury.lodging}}<div class="tier-item"><span class="check">✓</span><span>{{name}}{{#if rate}} - {{formatCurrency rate}}/night{{/if}}</span></div>{{/each}}
                        {{#each tiers.luxury.includes}}<div class="tier-item"><span class="check">✓</span><span>{{this}}</span></div>{{/each}}
                    </div>
                </div>
                {{/if}}
            </div>
        </div>
    </div>
    {{else}}
    {{#if budget}}
    <div class="section">
        <div class="section-header">Investment Summary</div>
        <div class="section-content">
            <div class="pricing-box">
                {{#if budget.perPerson}}<div class="pricing-row"><span>Per Person</span><span>{{formatCurrency budget.perPerson}}</span></div>{{/if}}
                {{#if travelers.count}}<div class="pricing-row"><span>Number of Travelers</span><span>{{travelers.count}}</span></div>{{/if}}
                {{#if budget.total}}<div class="pricing-row total"><span>Total Estimated Investment</span><span>{{formatCurrency budget.total}}</span></div>{{/if}}
            </div>
        </div>
    </div>
    {{/if}}
    {{/if}}

    <!-- Reserve Now Section -->
    <div class="reserve-section">
        <p>Ready to book? Secure your trip with a deposit.</p>
        <a href="{{_config.reserveUrl}}" class="reserve-btn" target="_blank">Reserve Now</a>
    </div>

    <!-- General Comment -->
    <div class="general-comment">
        <button class="comment-btn" onclick="openComment('general', 'Overall Trip')">
            💬 Questions or changes? Let us know
        </button>
    </div>

    <div class="footer">
        <p>Prepared with care by <span class="brand">SoMo Travel</span></p>
        <p style="margin-top: 5px;">Questions? We're here to help make your trip unforgettable.</p>
        <div class="qr-section" id="qr-section" style="margin-top: 20px; text-align: center;">
            <p style="font-size: 0.85em; color: var(--text-light); margin-bottom: 10px;">Scan to view on mobile</p>
            <img id="qr-code" alt="QR Code" style="width: 120px; height: 120px; border: 1px solid var(--border); border-radius: 8px; padding: 8px; background: white;">
        </div>
        <p style="margin-top: 15px; font-size: 0.8em;">Generated {{formatDate meta.lastUpdated}}</p>
        <p style="margin-top: 5px; font-size: 0.7em; color: #999;">Template: default v1.8 | Rendered: {{timestamp}}</p>
    </div>

    <!-- Comment Modal -->
    <div id="commentModal" class="comment-modal" onclick="if(event.target===this)closeComment()">
        <div class="comment-form">
            <h3 id="commentTitle">Comment on Section</h3>
            <input type="text" id="commentName" placeholder="Your name (optional)">
            <input type="email" id="commentEmail" placeholder="Email for reply (optional)">
            <textarea id="commentMessage" placeholder="Your question, feedback, or requested changes..."></textarea>
            <div class="comment-form-buttons">
                <button class="cancel-btn" onclick="closeComment()">Cancel</button>
                <button class="submit-btn" id="submitComment" onclick="submitComment()">Send</button>
            </div>
        </div>
    </div>

    <script>
        // Generate QR code for current page URL
        (function() {
            var qrImg = document.getElementById('qr-code');
            var url = encodeURIComponent(window.location.href);
            qrImg.src = 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=' + url;
        })();

        // Comment functionality
        var commentSection = '';
        var commentItem = '';
        var tripKey = '{{_config.tripKey}}';
        var apiEndpoint = '{{_config.apiEndpoint}}';

        function openComment(section, item) {
            commentSection = section;
            commentItem = item || '';
            document.getElementById('commentTitle').textContent = 'Comment on ' + (item || section);
            document.getElementById('commentModal').classList.add('active');
            document.getElementById('commentMessage').focus();
        }

        function closeComment() {
            document.getElementById('commentModal').classList.remove('active');
            document.getElementById('commentName').value = '';
            document.getElementById('commentEmail').value = '';
            document.getElementById('commentMessage').value = '';
        }

        function submitComment() {
            var message = document.getElementById('commentMessage').value.trim();
            if (!message) return;

            var btn = document.getElementById('submitComment');
            btn.disabled = true;
            btn.textContent = 'Sending...';

            fetch(apiEndpoint + '/comment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tripKey: tripKey,
                    section: commentSection,
                    item: commentItem,
                    message: message,
                    name: document.getElementById('commentName').value.trim() || null,
                    email: document.getElementById('commentEmail').value.trim() || null
                })
            })
            .then(function(res) { return res.json(); })
            .then(function(data) {
                if (data.success) {
                    document.querySelector('.comment-form').innerHTML = '<div class="comment-success"><h3>✓ Comment Sent!</h3><p>Your travel agent will review your message.</p><button class="cancel-btn" onclick="closeComment();location.reload();">Close</button></div>';
                } else {
                    throw new Error('Failed');
                }
            })
            .catch(function() {
                btn.disabled = false;
                btn.textContent = 'Send';
                alert('Failed to send comment. Please try again.');
            });
        }
    </script>
</body>
</html>`;
