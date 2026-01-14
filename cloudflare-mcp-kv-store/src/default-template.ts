/**
 * Default Handlebars template for trip proposals
 * Cruise Planners / SoMo Travel Specialist branded
 */
export const DEFAULT_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{meta.clientName}} - {{meta.destination}} | SoMo Travel Specialist</title>
    <style>
        :root {
            /* Cruise Planners / SoMo Travel Brand Colors */
            --primary: #1b619c;
            --primary-dark: #154a78;
            --secondary: #90c8ed;
            --secondary-light: #c5e4f7;
            --accent: #3baf2a;
            --accent-dark: #2d8a21;

            /* Neutrals */
            --white: #ffffff;
            --bg-light: #f5f9fc;
            --bg-section: #e8f4fc;
            --text: #2c3e50;
            --text-light: #5a6c7d;
            --border: #d1e3f0;
            --shadow: 0 4px 12px rgba(27, 97, 156, 0.15);
            --radius: 10px;
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.7;
            color: var(--text);
            background: var(--white);
        }

        /* Header with Logo */
        .header-bar {
            background: var(--primary);
            padding: 15px 30px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .logo-container {
            display: flex;
            align-items: center;
            gap: 15px;
        }

        .logo-container img {
            height: 50px;
            width: auto;
        }

        .logo-text {
            color: var(--white);
            font-size: 1.1em;
            font-weight: 500;
        }

        .header-contact {
            color: var(--secondary-light);
            font-size: 0.9em;
        }

        .header-contact a {
            color: var(--white);
            text-decoration: none;
            font-weight: 600;
        }

        /* Hero Section */
        .hero {
            background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
            color: var(--white);
            padding: 50px 30px;
            text-align: center;
        }

        .hero h1 {
            font-size: 2.4em;
            margin-bottom: 10px;
            font-weight: 700;
        }

        .hero .destination {
            font-size: 1.4em;
            opacity: 0.9;
            margin-bottom: 20px;
        }

        .hero .dates-badge {
            display: inline-block;
            background: var(--accent);
            padding: 12px 30px;
            border-radius: 30px;
            font-size: 1.1em;
            font-weight: 600;
        }

        .hero .tagline {
            margin-top: 25px;
            font-size: 1em;
            opacity: 0.8;
            font-style: italic;
        }

        /* Main Content */
        .content {
            max-width: 950px;
            margin: 0 auto;
            padding: 30px 20px;
        }

        /* Overview Cards */
        .overview-section {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
        }

        .overview-card {
            background: var(--bg-section);
            padding: 20px;
            border-radius: var(--radius);
            text-align: center;
            border-top: 4px solid var(--primary);
        }

        .overview-card .icon {
            font-size: 2em;
            margin-bottom: 10px;
        }

        .overview-card .label {
            font-size: 0.85em;
            color: var(--text-light);
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 5px;
        }

        .overview-card .value {
            font-size: 1.2em;
            font-weight: 700;
            color: var(--primary);
        }

        /* Section Styles */
        .section {
            margin-bottom: 35px;
        }

        .section-header {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 20px;
            padding-bottom: 12px;
            border-bottom: 3px solid var(--primary);
        }

        .section-header h2 {
            color: var(--primary);
            font-size: 1.4em;
            font-weight: 700;
        }

        .section-icon {
            background: var(--primary);
            color: var(--white);
            width: 40px;
            height: 40px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.2em;
        }

        /* Content Box */
        .content-box {
            background: var(--white);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            padding: 25px;
            box-shadow: var(--shadow);
        }

        /* Cards Grid */
        .cards-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 20px;
        }

        .card {
            background: var(--white);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            overflow: hidden;
            box-shadow: var(--shadow);
            transition: transform 0.2s, box-shadow 0.2s;
        }

        .card:hover {
            transform: translateY(-3px);
            box-shadow: 0 8px 20px rgba(27, 97, 156, 0.2);
        }

        .card-header {
            background: var(--primary);
            color: var(--white);
            padding: 15px 20px;
            font-weight: 600;
            font-size: 1.1em;
        }

        .card-body {
            padding: 20px;
        }

        .card-detail {
            display: flex;
            justify-content: space-between;
            padding: 10px 0;
            border-bottom: 1px solid var(--border);
            font-size: 0.95em;
        }

        .card-detail:last-child { border-bottom: none; }
        .card-detail .label { color: var(--text-light); }
        .card-detail .value { font-weight: 600; color: var(--text); }

        .card-link {
            display: inline-block;
            margin-top: 15px;
            padding: 10px 20px;
            background: var(--accent);
            color: var(--white);
            text-decoration: none;
            border-radius: 5px;
            font-weight: 600;
            font-size: 0.9em;
            transition: background 0.2s;
        }

        .card-link:hover { background: var(--accent-dark); }

        /* Card Images */
        .card-image {
            width: 100%;
            max-height: 180px;
            object-fit: cover;
            border-bottom: 1px solid var(--border);
        }

        .card-gallery {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 10px;
            margin-bottom: 15px;
        }

        .card-gallery img {
            width: 100%;
            height: 120px;
            object-fit: cover;
            border-radius: 6px;
            cursor: pointer;
            transition: transform 0.2s;
        }

        .card-gallery img:hover {
            transform: scale(1.05);
        }

        .image-caption {
            font-size: 0.85em;
            color: var(--text-light);
            text-align: center;
            margin-top: 5px;
        }

        /* Hero Gallery */
        .hero-gallery {
            display: flex;
            overflow-x: auto;
            gap: 0;
            background: var(--primary-dark);
            padding: 0;
        }

        .hero-gallery-item {
            flex: 0 0 auto;
            position: relative;
        }

        .hero-gallery-item img {
            height: 250px;
            width: auto;
            display: block;
        }

        .hero-gallery-item .image-caption {
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            background: rgba(0,0,0,0.6);
            color: white;
            padding: 8px 12px;
            font-size: 0.9em;
        }

        /* Flight Cards */
        .flight-card .card-header {
            background: linear-gradient(135deg, var(--secondary) 0%, var(--primary) 100%);
        }

        .flight-route {
            font-size: 1.3em;
            font-weight: 700;
            color: var(--primary);
            margin-bottom: 10px;
        }

        /* Day Itinerary */
        .day-card {
            margin-bottom: 20px;
            border-radius: var(--radius);
            overflow: hidden;
            border: 1px solid var(--border);
        }

        .day-header {
            background: var(--bg-section);
            padding: 15px 20px;
            display: flex;
            align-items: center;
            gap: 15px;
            border-bottom: 1px solid var(--border);
        }

        .day-number {
            background: var(--primary);
            color: var(--white);
            width: 50px;
            height: 50px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 1.2em;
        }

        .day-info h3 { color: var(--primary); margin-bottom: 3px; }
        .day-date { color: var(--text-light); font-size: 0.9em; }

        .day-content { padding: 20px; }

        .activity {
            padding: 15px;
            margin-bottom: 12px;
            background: var(--bg-light);
            border-radius: 8px;
            border-left: 4px solid var(--accent);
        }

        .activity:last-child { margin-bottom: 0; }
        .activity-title { font-weight: 600; color: var(--text); margin-bottom: 5px; }
        .activity-details { font-size: 0.95em; color: var(--text-light); }

        /* Pricing Section */
        .pricing-box {
            background: linear-gradient(135deg, var(--bg-section) 0%, var(--secondary-light) 100%);
            border: 2px solid var(--primary);
            border-radius: var(--radius);
            padding: 30px;
        }

        .pricing-row {
            display: flex;
            justify-content: space-between;
            padding: 12px 0;
            border-bottom: 1px solid var(--border);
            font-size: 1.05em;
        }

        .pricing-row:last-child { border-bottom: none; }

        .pricing-row.total {
            font-size: 1.4em;
            font-weight: 700;
            color: var(--primary);
            border-top: 3px solid var(--primary);
            margin-top: 15px;
            padding-top: 20px;
        }

        /* Highlight Boxes */
        .highlight-box {
            background: var(--secondary-light);
            border-left: 5px solid var(--primary);
            padding: 20px;
            border-radius: 0 var(--radius) var(--radius) 0;
            margin: 20px 0;
        }

        .highlight-box h4 {
            color: var(--primary);
            margin-bottom: 10px;
            font-size: 1.1em;
        }

        .alert-box {
            background: #fff8e6;
            border-left: 5px solid #f5a623;
            padding: 20px;
            border-radius: 0 var(--radius) var(--radius) 0;
            margin: 20px 0;
        }

        .alert-box h4 {
            color: #c7880a;
            margin-bottom: 10px;
        }

        /* Lists */
        ul { margin-left: 20px; }
        li { margin-bottom: 8px; }

        /* Traveler Names */
        .traveler-list {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin-bottom: 15px;
        }

        .traveler-badge {
            background: var(--primary);
            color: var(--white);
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 0.95em;
        }

        /* Footer */
        .footer {
            background: var(--primary);
            color: var(--white);
            padding: 40px 30px;
            margin-top: 50px;
        }

        .footer-content {
            max-width: 950px;
            margin: 0 auto;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 30px;
        }

        .footer-section h4 {
            font-size: 1.1em;
            margin-bottom: 15px;
            color: var(--secondary);
        }

        .footer-section p, .footer-section a {
            color: var(--secondary-light);
            font-size: 0.95em;
            line-height: 1.8;
        }

        .footer-section a {
            text-decoration: none;
        }

        .footer-section a:hover {
            color: var(--white);
        }

        .footer-bottom {
            text-align: center;
            padding-top: 30px;
            margin-top: 30px;
            border-top: 1px solid rgba(255,255,255,0.2);
            font-size: 0.85em;
            color: var(--secondary-light);
        }

        .footer-tagline {
            font-size: 1.2em;
            font-weight: 600;
            color: var(--white);
            margin-bottom: 5px;
        }

        /* Responsive */
        @media (max-width: 768px) {
            .header-bar { flex-direction: column; gap: 10px; text-align: center; }
            .hero h1 { font-size: 1.8em; }
            .hero .destination { font-size: 1.1em; }
            .content { padding: 20px 15px; }
            .cards-grid { grid-template-columns: 1fr; }
            .overview-section { grid-template-columns: repeat(2, 1fr); }
        }

        @media print {
            .header-bar, .hero { background: var(--primary) !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .card:hover { transform: none; box-shadow: var(--shadow); }
        }
    </style>
</head>
<body>
    <!-- Header Bar -->
    <div class="header-bar">
        <div class="logo-container">
            <img src="https://www.somotravelspecialist.com/images/web/svg/logo_white_base.svg" alt="Cruise Planners - SoMo Travel Specialist">
        </div>
        <div class="header-contact">
            Questions? Call <a href="tel:251-293-4992">251-293-4992</a>
        </div>
    </div>

    <!-- Hero Section -->
    <div class="hero" {{#if heroImage}}style="background: linear-gradient(rgba(27, 97, 156, 0.85), rgba(21, 74, 120, 0.9)), url('{{heroImage}}') center/cover;"{{/if}}>
        <h1>{{meta.clientName}}</h1>
        <div class="destination">{{meta.destination}}</div>
        {{#if meta.dates}}<div class="dates-badge">{{meta.dates}}</div>{{/if}}
        <div class="tagline">Let's Get You There - Your Adventure Awaits!</div>
    </div>

    <!-- Hero Images Gallery (if multiple) -->
    {{#if images.hero}}
    <div class="hero-gallery">
        {{#each images.hero}}
        <div class="hero-gallery-item">
            <img src="{{urls.medium}}" alt="{{caption}}">
            {{#if caption}}<div class="image-caption">{{caption}}</div>{{/if}}
        </div>
        {{/each}}
    </div>
    {{/if}}

    <!-- Main Content -->
    <div class="content">

        <!-- Overview Cards -->
        <div class="overview-section">
            {{#if travelers.count}}
            <div class="overview-card">
                <div class="icon">👥</div>
                <div class="label">Travelers</div>
                <div class="value">{{pluralize travelers.count "Guest" "Guests"}}</div>
            </div>
            {{/if}}

            {{#if dates.duration}}
            <div class="overview-card">
                <div class="icon">📅</div>
                <div class="label">Duration</div>
                <div class="value">{{dates.duration}} Days</div>
            </div>
            {{/if}}

            {{#if meta.phase}}
            <div class="overview-card">
                <div class="icon">📋</div>
                <div class="label">Status</div>
                <div class="value">{{capitalize meta.phase}}</div>
            </div>
            {{/if}}

            {{#if budget.total}}
            <div class="overview-card">
                <div class="icon">💰</div>
                <div class="label">Investment</div>
                <div class="value">{{formatCurrency budget.total}}</div>
            </div>
            {{/if}}
        </div>

        <!-- Travelers Section -->
        {{#if travelers.names}}
        <div class="section">
            <div class="section-header">
                <div class="section-icon">👥</div>
                <h2>Your Travel Party</h2>
            </div>
            <div class="content-box">
                <div class="traveler-list">
                    {{#each travelers.names}}<span class="traveler-badge">{{this}}</span>{{/each}}
                </div>
                {{#if travelers.notes}}
                <div class="highlight-box">
                    <h4>Trip Notes</h4>
                    <p>{{travelers.notes}}</p>
                </div>
                {{/if}}
            </div>
        </div>
        {{/if}}

        <!-- Preferences Section -->
        {{#if preferences}}
        <div class="section">
            <div class="section-header">
                <div class="section-icon">✨</div>
                <h2>Your Travel Style</h2>
            </div>
            <div class="content-box">
                {{#if preferences.vibe}}
                <p style="font-size: 1.1em; margin-bottom: 20px;"><strong>Vibe:</strong> {{preferences.vibe}}</p>
                {{/if}}

                {{#if preferences.mustHave}}
                <h4 style="color: var(--primary); margin-bottom: 10px;">Must-Haves</h4>
                <ul>{{#each preferences.mustHave}}<li>{{this}}</li>{{/each}}</ul>
                {{/if}}

                {{#if preferences.avoid}}
                <h4 style="color: var(--primary); margin-top: 20px; margin-bottom: 10px;">Prefer to Avoid</h4>
                <ul>{{#each preferences.avoid}}<li>{{this}}</li>{{/each}}</ul>
                {{/if}}
            </div>
        </div>
        {{/if}}

        <!-- Flights Section -->
        {{#if flights}}
        <div class="section">
            <div class="section-header">
                <div class="section-icon">✈️</div>
                <h2>Flight Details</h2>
            </div>
            <div class="cards-grid">
                {{#if flights.outbound}}
                <div class="card flight-card">
                    <div class="card-header">Outbound Flight</div>
                    <div class="card-body">
                        <div class="flight-route">{{flights.outbound.route}}</div>
                        <div class="card-detail"><span class="label">Date</span><span class="value">{{flights.outbound.date}}</span></div>
                        <div class="card-detail"><span class="label">Airline</span><span class="value">{{default flights.outbound.airline "TBD"}}</span></div>
                        {{#if flights.outbound.notes}}<p style="margin-top: 12px; font-size: 0.9em; color: var(--text-light);">{{flights.outbound.notes}}</p>{{/if}}
                    </div>
                </div>
                {{/if}}

                {{#if flights.return}}
                <div class="card flight-card">
                    <div class="card-header">Return Flight</div>
                    <div class="card-body">
                        <div class="flight-route">{{flights.return.route}}</div>
                        <div class="card-detail"><span class="label">Date</span><span class="value">{{flights.return.date}}</span></div>
                        <div class="card-detail"><span class="label">Airline</span><span class="value">{{default flights.return.airline "TBD"}}</span></div>
                    </div>
                </div>
                {{/if}}
            </div>

            {{#if flights.estimatedTotal}}
            <div class="highlight-box" style="margin-top: 20px;">
                <h4>Estimated Flight Cost</h4>
                <p>{{flights.estimatedTotal.range}} {{#if flights.estimatedTotal.notes}}- {{flights.estimatedTotal.notes}}{{/if}}</p>
            </div>
            {{/if}}
        </div>
        {{/if}}

        <!-- Lodging Section -->
        {{#if lodging}}
        <div class="section">
            <div class="section-header">
                <div class="section-icon">🏨</div>
                <h2>Accommodations</h2>
            </div>
            <div class="cards-grid">
                {{#each lodging}}
                <div class="card">
                    {{#if images}}
                    {{#each images}}
                    <img src="{{urls.medium}}" alt="{{caption}}" class="card-image">
                    {{/each}}
                    {{/if}}
                    <div class="card-header">{{name}}</div>
                    <div class="card-body">
                        <div class="card-detail"><span class="label">Location</span><span class="value">{{location}}</span></div>
                        {{#if nights}}<div class="card-detail"><span class="label">Nights</span><span class="value">{{nights}}</span></div>{{/if}}
                        {{#if checkIn}}<div class="card-detail"><span class="label">Check-in</span><span class="value">{{checkIn}}</span></div>{{/if}}
                        {{#if checkOut}}<div class="card-detail"><span class="label">Check-out</span><span class="value">{{checkOut}}</span></div>{{/if}}
                        {{#if rate}}<div class="card-detail"><span class="label">Rate</span><span class="value">{{formatCurrency rate}}/night</span></div>{{/if}}
                        {{#if url}}<a href="{{url}}" class="card-link" target="_blank">View Property →</a>{{/if}}
                    </div>
                </div>
                {{/each}}
            </div>
        </div>
        {{/if}}

        <!-- Narrowboat Section -->
        {{#if narrowboat}}
        <div class="section">
            <div class="section-header">
                <div class="section-icon">🚢</div>
                <h2>Narrowboat Details</h2>
            </div>
            <div class="content-box">
                <div class="overview-section" style="margin-bottom: 25px;">
                    <div class="overview-card">
                        <div class="label">Duration</div>
                        <div class="value">{{narrowboat.duration}}</div>
                    </div>
                    {{#if narrowboat.requirements.cabins}}
                    <div class="overview-card">
                        <div class="label">Cabins</div>
                        <div class="value">{{narrowboat.requirements.cabins}}</div>
                    </div>
                    {{/if}}
                    {{#if narrowboat.requirements.bathrooms}}
                    <div class="overview-card">
                        <div class="label">Bathrooms</div>
                        <div class="value">{{narrowboat.requirements.bathrooms}}</div>
                    </div>
                    {{/if}}
                </div>

                {{#if narrowboat.recommendedCompanies}}
                <h4 style="color: var(--primary); margin-bottom: 15px;">Recommended Companies</h4>
                <div class="cards-grid">
                    {{#each narrowboat.recommendedCompanies}}
                    <div class="card">
                        <div class="card-header">{{name}}</div>
                        <div class="card-body">
                            {{#if notes}}<p style="font-size: 0.9em; margin-bottom: 12px;">{{notes}}</p>{{/if}}
                            {{#if trainAccess}}<div class="card-detail"><span class="label">Train Access</span><span class="value">{{trainAccess}}</span></div>{{/if}}
                            {{#if phone}}<div class="card-detail"><span class="label">Phone</span><span class="value">{{phone}}</span></div>{{/if}}
                            {{#if url}}<a href="{{url}}" class="card-link" target="_blank">Visit Website →</a>{{/if}}
                        </div>
                    </div>
                    {{/each}}
                </div>
                {{/if}}

                {{#if narrowboat.estimatedCost}}
                <div class="highlight-box" style="margin-top: 25px;">
                    <h4>Estimated Boat Cost</h4>
                    <p>{{narrowboat.estimatedCost.range}} {{#if narrowboat.estimatedCost.notes}}- {{narrowboat.estimatedCost.notes}}{{/if}}</p>
                </div>
                {{/if}}
            </div>
        </div>
        {{/if}}

        <!-- Itinerary Section -->
        {{#if itinerary}}
        <div class="section">
            <div class="section-header">
                <div class="section-icon">📍</div>
                <h2>Day-by-Day Itinerary</h2>
            </div>
            {{#each itinerary}}
            <div class="day-card">
                <div class="day-header">
                    <div class="day-number">{{day}}</div>
                    <div class="day-info">
                        <h3>{{location}}</h3>
                        {{#if date}}<div class="day-date">{{date}}</div>{{/if}}
                    </div>
                </div>
                <div class="day-content">
                    {{#if images}}
                    <div class="card-gallery" style="margin-bottom: 20px;">
                        {{#each images}}
                        <img src="{{urls.medium}}" alt="{{caption}}" title="{{caption}}">
                        {{/each}}
                    </div>
                    {{/if}}
                    {{#each activities}}
                    <div class="activity">
                        {{#if images}}
                        <div class="card-gallery" style="margin-bottom: 10px;">
                            {{#each images}}
                            <img src="{{urls.thumbnail}}" alt="{{caption}}" title="{{caption}}">
                            {{/each}}
                        </div>
                        {{/if}}
                        <div class="activity-title">{{name}}</div>
                        {{#if notes}}<div class="activity-details">{{notes}}</div>{{/if}}
                        {{#if url}}<a href="{{url}}" class="card-link" style="margin-top: 8px; padding: 6px 12px; font-size: 0.85em;" target="_blank">More Info →</a>{{/if}}
                    </div>
                    {{/each}}
                </div>
            </div>
            {{/each}}
        </div>
        {{/if}}

        <!-- Extras / Recommendations Section -->
        {{#if extras}}
        <div class="section">
            <div class="section-header">
                <div class="section-icon">💎</div>
                <h2>Special Recommendations</h2>
            </div>
            <div class="cards-grid">
                {{#if extras.hiddenGem}}
                <div class="card" style="border-top: 4px solid #f5a623;">
                    <div class="card-body">
                        <h4 style="color: #c7880a; margin-bottom: 10px;">🌟 Hidden Gem</h4>
                        <p style="font-weight: 600; color: var(--text);">{{extras.hiddenGem.name}}</p>
                        <p style="margin-top: 10px;">{{extras.hiddenGem.why}}</p>
                        {{#if extras.hiddenGem.howToDoIt}}<p style="margin-top: 10px;"><strong>Pro Tip:</strong> {{extras.hiddenGem.howToDoIt}}</p>{{/if}}
                        {{#if extras.hiddenGem.url}}<a href="{{extras.hiddenGem.url}}" class="card-link" target="_blank">Learn More →</a>{{/if}}
                    </div>
                </div>
                {{/if}}

                {{#if extras.waterFeaturePhotoOp}}
                <div class="card" style="border-top: 4px solid var(--secondary);">
                    <div class="card-body">
                        <h4 style="color: var(--primary); margin-bottom: 10px;">📸 Photo Opportunity</h4>
                        <p style="font-weight: 600; color: var(--text);">{{extras.waterFeaturePhotoOp.name}}</p>
                        <p style="margin-top: 10px;">{{extras.waterFeaturePhotoOp.why}}</p>
                        {{#if extras.waterFeaturePhotoOp.howToDoIt}}<p style="margin-top: 10px;"><strong>Pro Tip:</strong> {{extras.waterFeaturePhotoOp.howToDoIt}}</p>{{/if}}
                    </div>
                </div>
                {{/if}}
            </div>
        </div>
        {{/if}}

        <!-- Featured Links Section -->
        {{#if featuredLinks}}
        <div class="section">
            <div class="section-header">
                <div class="section-icon">🔗</div>
                <h2>Useful Resources</h2>
            </div>
            <div class="cards-grid">
                {{#each featuredLinks}}
                <div class="card">
                    <div class="card-body">
                        <h4 style="color: var(--primary); margin-bottom: 8px;">{{title}}</h4>
                        <p style="font-size: 0.95em; color: var(--text-light); margin-bottom: 12px;">{{description}}</p>
                        <a href="{{url}}" class="card-link" target="_blank">View Resource →</a>
                    </div>
                </div>
                {{/each}}
            </div>
        </div>
        {{/if}}

        <!-- Pricing Section -->
        {{#if budget}}
        <div class="section">
            <div class="section-header">
                <div class="section-icon">💰</div>
                <h2>Investment Summary</h2>
            </div>
            <div class="pricing-box">
                {{#if budget.perPerson}}<div class="pricing-row"><span>Per Person</span><span>{{formatCurrency budget.perPerson}}</span></div>{{/if}}
                {{#if travelers.count}}<div class="pricing-row"><span>Number of Travelers</span><span>{{travelers.count}}</span></div>{{/if}}
                {{#if budget.total}}<div class="pricing-row total"><span>Total Trip Investment</span><span>{{formatCurrency budget.total}}</span></div>{{/if}}
            </div>
        </div>
        {{/if}}

    </div>

    <!-- Footer -->
    <div class="footer">
        <div class="footer-content">
            <div class="footer-section">
                <div class="footer-tagline">Begin Your Adventure Today</div>
                <p>Travel is our passion, and our area of expertise. Let us help you create memories that last a lifetime.</p>
            </div>
            <div class="footer-section">
                <h4>Contact Your Travel Advisor</h4>
                <p>
                    📞 <a href="tel:251-293-4992">251-293-4992</a><br>
                    🌐 <a href="https://www.somotravelspecialist.com">somotravelspecialist.com</a>
                </p>
            </div>
            <div class="footer-section">
                <h4>Cruise Planners</h4>
                <p>
                    FL ST# 39068 | CA ST# 2034468-50<br>
                    HI ST# TAR-7058 | WA ST# 603-399-504
                </p>
            </div>
        </div>
        <div class="footer-bottom">
            <p>Prepared with care by SoMo Travel Specialist, a Cruise Planners Franchise</p>
            <p style="margin-top: 5px;">Generated {{formatDate meta.lastUpdated}}</p>
        </div>
    </div>
</body>
</html>`;
