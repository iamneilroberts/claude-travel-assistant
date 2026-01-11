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
    </style>
</head>
<body>
    <div class="header">
        <h1>{{meta.clientName}}</h1>
        <div class="subtitle">{{meta.destination}}</div>
        {{#if meta.dates}}<div class="dates">{{meta.dates}}</div>{{/if}}
    </div>

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
        <div class="section-header">Flights</div>
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
        <div class="section-header">Accommodations</div>
        <div class="section-content">
            <div class="cards-grid">
            {{#each lodging}}
                <div class="card hotel-card">
                    <h4>{{name}}</h4>
                    <div class="card-detail"><span class="label">Location</span><span class="value">{{location}}</span></div>
                    {{#if dates}}<div class="card-detail"><span class="label">Dates</span><span class="value">{{dates}}</span></div>{{/if}}
                    {{#if rate}}<div class="card-detail"><span class="label">Rate</span><span class="value">{{formatCurrency rate}}/night</span></div>{{/if}}
                    {{#if url}}<a href="{{url}}" class="card-link" target="_blank">View Hotel</a>{{/if}}
                </div>
            {{/each}}
            </div>
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
        <div class="section-header">Day-by-Day Itinerary</div>
        <div class="section-content">
            {{#each itinerary}}
            <div class="day-section">
                <div class="day-header">
                    <div class="day-number">{{day}}</div>
                    <div class="day-info">
                        <h3>{{location}}</h3>
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

    <div class="footer">
        <p>Prepared with care by <span class="brand">SoMo Travel</span></p>
        <p style="margin-top: 5px;">Questions? We're here to help make your trip unforgettable.</p>
        <p style="margin-top: 15px; font-size: 0.8em;">Generated {{formatDate meta.lastUpdated}}</p>
    </div>
</body>
</html>`;
