/**
 * Subdomain route handler
 * Handles requests to *.voygent.ai subdomains
 */

import type { Env, UserProfile } from '../../types';
import { extractSubdomain, getSubdomainOwner } from '../../lib/subdomain';
import { handleUserDashboard } from './dashboard';
import { handlePublishedTrip, handleSubdomainHome } from './published';
import { handleUpload } from '../upload';

/**
 * Main subdomain route handler
 * Returns Response if handled, null if not a subdomain request
 */
export async function handleSubdomainRoutes(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  url: URL,
  corsHeaders: Record<string, string>
): Promise<Response | null> {
  // Extract subdomain from hostname
  const subdomain = extractSubdomain(url.hostname);

  // Not a subdomain request
  if (!subdomain) {
    return null;
  }

  // Reserved subdomains - pass through to main handler
  if (['www', 'api', 'admin'].includes(subdomain)) {
    return null;
  }

  // Look up subdomain owner
  const userId = await getSubdomainOwner(env, subdomain);

  if (!userId) {
    // Subdomain not registered
    return new Response(getSubdomainNotFoundHtml(subdomain), {
      status: 404,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        ...corsHeaders
      }
    });
  }

  // Load user profile
  const userProfile = await env.TRIPS.get(`_users/${userId}`, 'json') as UserProfile | null;

  if (!userProfile) {
    // User not found - shouldn't happen if subdomain is registered
    return new Response('User not found', { status: 404 });
  }

  // Route based on path
  const path = url.pathname;

  // Dashboard routes: /admin, /admin/*, /admin/login, etc.
  if (path === '/admin' || path.startsWith('/admin/')) {
    return handleUserDashboard(request, env, ctx, url, userProfile, subdomain, corsHeaders);
  }

  // Upload route - used by dashboard branding settings
  if (path === '/upload') {
    const uploadResponse = await handleUpload(request, env, ctx, url, corsHeaders);
    if (uploadResponse) return uploadResponse;
  }

  // Published trip routes: /trips/*, /*.html
  if (path.startsWith('/trips/') || (path.endsWith('.html') && path !== '/index.html')) {
    return handlePublishedTrip(request, env, ctx, url, userProfile, corsHeaders);
  }

  // Root or index - show subdomain home
  if (path === '/' || path === '/index.html') {
    return handleSubdomainHome(request, env, ctx, url, userProfile, subdomain, corsHeaders);
  }

  // Unknown path - return 404
  return new Response('Not Found', { status: 404, headers: corsHeaders });
}

/**
 * HTML for subdomain not found page
 */
function getSubdomainNotFoundHtml(subdomain: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Not Found - Voygent</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
    }
    .container {
      text-align: center;
      padding: 2rem;
      max-width: 500px;
    }
    h1 { font-size: 4rem; margin-bottom: 1rem; opacity: 0.9; }
    p { font-size: 1.2rem; margin-bottom: 2rem; opacity: 0.8; }
    a {
      display: inline-block;
      background: white;
      color: #667eea;
      padding: 0.75rem 2rem;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 600;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    a:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 20px rgba(0,0,0,0.2);
    }
    .subdomain { font-family: monospace; background: rgba(255,255,255,0.2); padding: 0.2rem 0.5rem; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>404</h1>
    <p>The subdomain <span class="subdomain">${subdomain}.voygent.ai</span> is not registered.</p>
    <a href="https://voygent.ai">Go to Voygent</a>
  </div>
</body>
</html>`;
}

export { handleUserDashboard } from './dashboard';
export { handlePublishedTrip, handleSubdomainHome } from './published';
