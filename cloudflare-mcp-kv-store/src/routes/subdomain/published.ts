/**
 * Published trip handler for subdomain routes
 * Serves published trips from R2 and tracks page views
 */

import type { Env, UserProfile } from '../../types';
import { getPublishedTrip, listPublishedTrips, getDraftTrip } from '../../lib/published';
import { trackPageView } from '../../lib/stats';

/**
 * Handle requests for draft/preview trips
 * Routes: /drafts/{filename}.html
 */
export async function handleDraftTrip(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  url: URL,
  userProfile: UserProfile,
  corsHeaders: Record<string, string>
): Promise<Response | null> {
  const path = url.pathname;

  // Extract filename from path
  let filename = path.slice(8); // Remove '/drafts/'

  // Ensure .html extension
  if (!filename.endsWith('.html')) {
    filename += '.html';
  }

  // Get the HTML from R2 drafts folder
  const html = await getDraftTrip(env, userProfile.userId, filename);

  if (!html) {
    return new Response(getDraftNotFoundHtml(filename), {
      status: 404,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        ...corsHeaders
      }
    });
  }

  // Check for cache-bust param (used by publish verification)
  const noCacheRequested = url.searchParams.has('_t');

  // Return the HTML with appropriate caching
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': noCacheRequested
        ? 'no-store, no-cache, must-revalidate'
        : 'public, max-age=60, stale-while-revalidate=30',
      ...corsHeaders
    }
  });
}

/**
 * HTML for draft not found page
 */
function getDraftNotFoundHtml(filename: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Draft Not Found</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f5;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #333;
    }
    .container {
      text-align: center;
      padding: 2rem;
      max-width: 500px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.1);
    }
    h1 { font-size: 2rem; margin-bottom: 1rem; color: #f59e0b; }
    p { font-size: 1rem; margin-bottom: 1rem; color: #666; }
    .filename { font-family: monospace; background: #f0f0f0; padding: 0.2rem 0.5rem; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Draft Not Found</h1>
    <p>The draft <span class="filename">${filename}</span> could not be found.</p>
    <p>Drafts expire after a short time. Generate a new preview to view this trip.</p>
  </div>
</body>
</html>`;
}

/**
 * Handle requests for published trips
 * Routes: /trips/{filename}.html, /{filename}.html
 */
export async function handlePublishedTrip(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  url: URL,
  userProfile: UserProfile,
  corsHeaders: Record<string, string>
): Promise<Response | null> {
  const path = url.pathname;

  // Extract filename from path
  let filename: string;
  if (path.startsWith('/trips/')) {
    filename = path.slice(7); // Remove '/trips/'
  } else if (path.endsWith('.html')) {
    filename = path.slice(1); // Remove leading '/'
  } else {
    return null;
  }

  // Ensure .html extension
  if (!filename.endsWith('.html')) {
    filename += '.html';
  }

  // Extract tripId from filename (remove .html)
  const tripId = filename.replace('.html', '');

  // Get the HTML from R2
  const html = await getPublishedTrip(env, userProfile.userId, filename);

  if (!html) {
    return new Response(getNotFoundHtml(filename, userProfile), {
      status: 404,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        ...corsHeaders
      }
    });
  }

  // Track page view asynchronously
  ctx.waitUntil(trackPageView(env, userProfile.userId, tripId));

  // Return the HTML with caching headers
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=60',
      ...corsHeaders
    }
  });
}

/**
 * Handle requests for subdomain home page
 * Shows list of published trips
 */
export async function handleSubdomainHome(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  url: URL,
  userProfile: UserProfile,
  subdomain: string,
  corsHeaders: Record<string, string>
): Promise<Response> {
  // Get list of published trips
  const publishedTrips = await listPublishedTrips(env, userProfile.userId);

  // Filter to only show non-testing trips
  const visibleTrips = publishedTrips.filter(t =>
    t.category !== 'testing' && t.category !== 'draft'
  );

  const html = getSubdomainHomeHtml(userProfile, subdomain, visibleTrips);

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=60',
      ...corsHeaders
    }
  });
}

/**
 * HTML for trip not found page
 */
function getNotFoundHtml(filename: string, userProfile: UserProfile): string {
  const displayName = userProfile.agency?.name || userProfile.name || 'Travel Advisor';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Trip Not Found - ${displayName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f5;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #333;
    }
    .container {
      text-align: center;
      padding: 2rem;
      max-width: 500px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.1);
    }
    h1 { font-size: 2rem; margin-bottom: 1rem; color: #667eea; }
    p { font-size: 1rem; margin-bottom: 1.5rem; color: #666; }
    a {
      display: inline-block;
      background: #667eea;
      color: white;
      padding: 0.75rem 2rem;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 600;
      transition: background 0.2s;
    }
    a:hover { background: #5a6fd6; }
    .filename { font-family: monospace; background: #f0f0f0; padding: 0.2rem 0.5rem; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Trip Not Found</h1>
    <p>The trip <span class="filename">${filename}</span> could not be found.</p>
    <p>It may have been unpublished or moved.</p>
    <a href="/">View All Trips</a>
  </div>
</body>
</html>`;
}

/**
 * HTML for subdomain home page showing published trips
 */
function getSubdomainHomeHtml(
  userProfile: UserProfile,
  subdomain: string,
  trips: Array<{
    tripId: string;
    filename: string;
    title: string;
    destination?: string;
    category: string;
    publishedAt: string;
    lastModified: string;
    views?: number;
  }>
): string {
  const displayName = userProfile.agency?.name || userProfile.name || 'Travel Advisor';
  const primaryColor = userProfile.branding?.primaryColor || '#667eea';
  const logo = userProfile.agency?.logo;

  const tripCards = trips.length > 0
    ? trips.map(trip => `
        <a href="/trips/${trip.filename}" class="trip-card">
          <div class="trip-title">${escapeHtml(trip.title)}</div>
          ${trip.destination ? `<div class="trip-destination">${escapeHtml(trip.destination)}</div>` : ''}
          <div class="trip-meta">
            <span class="trip-category">${escapeHtml(trip.category)}</span>
            <span class="trip-date">${formatDate(trip.publishedAt)}</span>
          </div>
        </a>
      `).join('')
    : '<p class="no-trips">No trips published yet.</p>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(displayName)} - Travel Proposals</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f8f9fa;
      min-height: 100vh;
      color: #333;
    }
    .header {
      background: ${primaryColor};
      color: white;
      padding: 2rem;
      text-align: center;
    }
    .header-logo {
      max-height: 60px;
      max-width: 200px;
      margin-bottom: 1rem;
    }
    .header h1 {
      font-size: 1.75rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
    }
    .header p {
      opacity: 0.9;
      font-size: 1rem;
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
      padding: 2rem;
    }
    .section-title {
      font-size: 1.25rem;
      font-weight: 600;
      margin-bottom: 1.5rem;
      color: #444;
    }
    .trips-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1.5rem;
    }
    .trip-card {
      display: block;
      background: white;
      border-radius: 12px;
      padding: 1.5rem;
      text-decoration: none;
      color: inherit;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .trip-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 24px rgba(0,0,0,0.12);
    }
    .trip-title {
      font-size: 1.1rem;
      font-weight: 600;
      color: ${primaryColor};
      margin-bottom: 0.5rem;
    }
    .trip-destination {
      font-size: 0.95rem;
      color: #666;
      margin-bottom: 0.75rem;
    }
    .trip-meta {
      display: flex;
      justify-content: space-between;
      font-size: 0.8rem;
      color: #888;
    }
    .trip-category {
      background: #f0f0f0;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      text-transform: capitalize;
    }
    .no-trips {
      text-align: center;
      color: #888;
      padding: 3rem;
      background: white;
      border-radius: 12px;
    }
    .footer {
      text-align: center;
      padding: 2rem;
      color: #888;
      font-size: 0.85rem;
    }
    .footer a {
      color: ${primaryColor};
      text-decoration: none;
    }
    .footer a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="header">
    ${logo ? `<img src="${escapeHtml(logo)}" alt="${escapeHtml(displayName)}" class="header-logo">` : ''}
    <h1>${escapeHtml(displayName)}</h1>
    <p>Travel Proposals & Itineraries</p>
  </div>

  <div class="container">
    <h2 class="section-title">Published Proposals</h2>
    <div class="trips-grid">
      ${tripCards}
    </div>
  </div>

  <div class="footer">
    <p>Powered by <a href="https://voygent.ai">Voygent</a></p>
  </div>
</body>
</html>`;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(str: string): string {
  const htmlEscapes: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };
  return str.replace(/[&<>"']/g, char => htmlEscapes[char]);
}

/**
 * Format date for display
 */
function formatDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  } catch {
    return isoString;
  }
}
