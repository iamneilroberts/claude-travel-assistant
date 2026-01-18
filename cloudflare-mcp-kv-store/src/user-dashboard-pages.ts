/**
 * Server-rendered HTML templates for user dashboard
 */

import type { UserProfile, MonthlyUsage } from './types';

/**
 * Common HTML head with styles
 */
function getCommonHead(title: string, primaryColor: string = '#667eea'): string {
  return `
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)} - Voygent Dashboard</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      :root {
        --primary: ${primaryColor};
        --primary-dark: color-mix(in srgb, ${primaryColor} 80%, black);
        --bg: #f8f9fa;
        --card-bg: white;
        --text: #333;
        --text-muted: #666;
        --border: #e0e0e0;
        --success: #28a745;
        --warning: #ffc107;
        --danger: #dc3545;
      }
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background: var(--bg);
        color: var(--text);
        min-height: 100vh;
      }
      a { color: var(--primary); text-decoration: none; }
      a:hover { text-decoration: underline; }

      /* Header */
      .header {
        background: var(--primary);
        color: white;
        padding: 1rem 2rem;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .header-brand { font-size: 1.25rem; font-weight: 600; color: white; }
      .header-brand:hover { text-decoration: none; }
      .header-nav { display: flex; gap: 1.5rem; align-items: center; }
      .header-nav a { color: rgba(255,255,255,0.9); font-size: 0.9rem; }
      .header-nav a:hover { color: white; text-decoration: none; }
      .header-nav a.active { color: white; font-weight: 600; }

      /* Layout */
      .container { max-width: 1100px; margin: 0 auto; padding: 2rem; }
      .page-title { font-size: 1.5rem; font-weight: 600; margin-bottom: 1.5rem; }

      /* Cards */
      .card {
        background: var(--card-bg);
        border-radius: 12px;
        padding: 1.5rem;
        box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        margin-bottom: 1.5rem;
      }
      .card-title {
        font-size: 1rem;
        font-weight: 600;
        margin-bottom: 1rem;
        color: var(--text-muted);
      }

      /* Stats Grid */
      .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 1rem;
        margin-bottom: 1.5rem;
      }
      .stat-card {
        background: var(--card-bg);
        border-radius: 12px;
        padding: 1.25rem;
        text-align: center;
        box-shadow: 0 2px 8px rgba(0,0,0,0.06);
      }
      .stat-value { font-size: 2rem; font-weight: 700; color: var(--primary); }
      .stat-label { font-size: 0.85rem; color: var(--text-muted); margin-top: 0.25rem; }

      /* Tables */
      .table-wrapper { overflow-x: auto; }
      table { width: 100%; border-collapse: collapse; }
      th, td { padding: 0.75rem 1rem; text-align: left; border-bottom: 1px solid var(--border); }
      th { font-weight: 600; color: var(--text-muted); font-size: 0.85rem; }
      tr:hover td { background: #f8f9fa; }

      /* Forms */
      .form-group { margin-bottom: 1.25rem; }
      .form-label { display: block; font-weight: 500; margin-bottom: 0.5rem; font-size: 0.9rem; }
      .form-input {
        width: 100%;
        padding: 0.75rem 1rem;
        border: 1px solid var(--border);
        border-radius: 8px;
        font-size: 1rem;
        transition: border-color 0.2s, box-shadow 0.2s;
      }
      .form-input:focus {
        outline: none;
        border-color: var(--primary);
        box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
      }
      .form-hint { font-size: 0.8rem; color: var(--text-muted); margin-top: 0.35rem; }

      /* Buttons */
      .btn {
        display: inline-block;
        padding: 0.75rem 1.5rem;
        border: none;
        border-radius: 8px;
        font-size: 1rem;
        font-weight: 500;
        cursor: pointer;
        transition: background 0.2s, transform 0.1s;
      }
      .btn:hover { transform: translateY(-1px); }
      .btn-primary { background: var(--primary); color: white; }
      .btn-primary:hover { background: var(--primary-dark); text-decoration: none; }
      .btn-secondary { background: #e9ecef; color: var(--text); }
      .btn-danger { background: var(--danger); color: white; }
      .btn-sm { padding: 0.5rem 1rem; font-size: 0.875rem; }

      /* Badges */
      .badge {
        display: inline-block;
        padding: 0.25rem 0.5rem;
        border-radius: 4px;
        font-size: 0.75rem;
        font-weight: 500;
        text-transform: uppercase;
      }
      .badge-success { background: #d4edda; color: #155724; }
      .badge-warning { background: #fff3cd; color: #856404; }
      .badge-danger { background: #f8d7da; color: #721c24; }
      .badge-info { background: #e3f2fd; color: #0d47a1; }

      /* Alerts */
      .alert {
        padding: 1rem 1.25rem;
        border-radius: 8px;
        margin-bottom: 1.5rem;
      }
      .alert-success { background: #d4edda; color: #155724; }
      .alert-warning { background: #fff3cd; color: #856404; }
      .alert-danger { background: #f8d7da; color: #721c24; }
      .alert-info { background: #e3f2fd; color: #0d47a1; }

      /* Quick Launch */
      .quick-launch {
        background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
        border-radius: 12px;
        padding: 1.5rem;
        color: white;
        margin-bottom: 1.5rem;
      }
      .quick-launch-title { font-size: 1.1rem; font-weight: 600; margin-bottom: 0.75rem; }
      .quick-launch-text { font-size: 0.9rem; opacity: 0.9; margin-bottom: 1rem; }
      .quick-launch .btn { background: white; color: var(--primary); }

      /* Copy Box */
      .copy-box {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        background: #f0f0f0;
        border-radius: 8px;
        padding: 0.75rem 1rem;
        font-family: monospace;
        font-size: 0.85rem;
        word-break: break-all;
      }
      .copy-box-btn {
        flex-shrink: 0;
        padding: 0.5rem 0.75rem;
        background: var(--primary);
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.8rem;
      }

      /* Login page specific */
      .login-container {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        padding: 2rem;
      }
      .login-card {
        background: white;
        border-radius: 16px;
        padding: 2.5rem;
        width: 100%;
        max-width: 400px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.1);
      }
      .login-logo { text-align: center; margin-bottom: 1.5rem; }
      .login-title { font-size: 1.5rem; text-align: center; margin-bottom: 0.5rem; }
      .login-subtitle { text-align: center; color: var(--text-muted); margin-bottom: 2rem; }

      /* Responsive */
      @media (max-width: 768px) {
        .container { padding: 1rem; }
        .header { padding: 1rem; flex-direction: column; gap: 1rem; }
        .header-nav { flex-wrap: wrap; justify-content: center; }
        .stats-grid { grid-template-columns: repeat(2, 1fr); }
      }
    </style>
  `;
}

/**
 * Common navigation
 */
function getNav(subdomain: string, activePage: string): string {
  return `
    <header class="header">
      <a href="/admin" class="header-brand">${escapeHtml(subdomain)}.voygent.ai</a>
      <nav class="header-nav">
        <a href="/admin" class="${activePage === 'home' ? 'active' : ''}">Dashboard</a>
        <a href="/admin/trips" class="${activePage === 'trips' ? 'active' : ''}">Trips</a>
        <a href="/admin/comments" class="${activePage === 'comments' ? 'active' : ''}">Comments</a>
        <a href="/admin/settings" class="${activePage === 'settings' ? 'active' : ''}">Settings</a>
        <form action="/admin/logout" method="POST" style="display:inline;">
          <button type="submit" style="background:none;border:none;color:rgba(255,255,255,0.9);cursor:pointer;font-size:0.9rem;">Logout</button>
        </form>
      </nav>
    </header>
  `;
}

/**
 * Login page HTML
 */
export function getLoginPageHtml(
  subdomain: string,
  userProfile: UserProfile,
  error?: string
): string {
  const primaryColor = userProfile.branding?.primaryColor || '#667eea';
  const displayName = userProfile.agency?.name || userProfile.name || 'Travel Advisor';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  ${getCommonHead('Login', primaryColor)}
</head>
<body>
  <div class="login-container">
    <div class="login-card">
      <div class="login-logo">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="${primaryColor}">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
        </svg>
      </div>
      <h1 class="login-title">${escapeHtml(displayName)}</h1>
      <p class="login-subtitle">Sign in to your dashboard</p>

      ${error ? `<div class="alert alert-danger">${escapeHtml(error)}</div>` : ''}

      <form method="POST" action="/admin/login">
        <div class="form-group">
          <label class="form-label" for="email">Email Address</label>
          <input type="email" id="email" name="email" class="form-input" placeholder="Enter your email" required autofocus>
          <p class="form-hint">We'll send you a magic link to sign in</p>
        </div>

        <button type="submit" class="btn btn-primary" style="width:100%;">Send Magic Link</button>
      </form>

      <p style="text-align:center;margin-top:2rem;font-size:0.85rem;color:var(--text-muted);">
        Powered by <a href="https://voygent.ai">Voygent</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Magic link sent page
 */
export function getMagicLinkSentHtml(
  subdomain: string,
  userProfile: UserProfile,
  email: string,
  magicLinkUrl: string
): string {
  const primaryColor = userProfile.branding?.primaryColor || '#667eea';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  ${getCommonHead('Check Your Email', primaryColor)}
</head>
<body>
  <div class="login-container">
    <div class="login-card">
      <div class="login-logo">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="${primaryColor}">
          <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
        </svg>
      </div>
      <h1 class="login-title">Check Your Email</h1>
      <p class="login-subtitle">We sent a magic link to <strong>${escapeHtml(email)}</strong></p>

      <div class="alert alert-info" style="margin-top:1.5rem;">
        <strong>Note:</strong> Email sending is not enabled yet. Use the link below to sign in.
      </div>

      <div style="margin-top:1.5rem;">
        <p style="font-size:0.9rem;color:var(--text-muted);margin-bottom:0.5rem;">Magic Link (click or copy):</p>
        <div class="copy-box">
          <a href="${escapeHtml(magicLinkUrl)}" style="flex:1;word-break:break-all;">${escapeHtml(magicLinkUrl)}</a>
        </div>
      </div>

      <p style="text-align:center;margin-top:2rem;">
        <a href="/admin/login">Back to Login</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Dashboard home page
 */
export function getDashboardHomeHtml(
  userProfile: UserProfile,
  subdomain: string,
  stats: { totalTrips: number; publishedTrips: number; totalViews: number; viewsLast30Days: number; unreadComments: number; topTrips: any[] },
  recentTrips: any[],
  usage?: MonthlyUsage
): string {
  const primaryColor = userProfile.branding?.primaryColor || '#667eea';
  const displayName = userProfile.agency?.name || userProfile.name || 'Travel Advisor';

  // Usage and limits
  const publishLimit = userProfile.subscription?.publishLimit ?? 10;
  const publishCount = usage?.publishCount ?? 0;
  const isUnlimited = publishLimit === -1;
  const isNearLimit = !isUnlimited && publishCount >= publishLimit * 0.8;
  const periodEnd = userProfile.subscription?.currentPeriodEnd;

  // Subscription badge
  const subStatus = userProfile.subscription?.status || 'unknown';
  const subTier = userProfile.subscription?.tier || 'trial';
  let subBadge = '<span class="badge badge-info">Trial</span>';
  if (subStatus === 'active') subBadge = '<span class="badge badge-success">Active</span>';
  else if (subStatus === 'past_due') subBadge = '<span class="badge badge-warning">Past Due</span>';
  else if (subStatus === 'canceled') subBadge = '<span class="badge badge-danger">Canceled</span>';

  const recentTripsHtml = recentTrips.length > 0
    ? recentTrips.map(trip => `
        <tr>
          <td><a href="/trips/${escapeHtml(trip.filename)}">${escapeHtml(trip.title)}</a></td>
          <td><span class="badge badge-info">${escapeHtml(trip.category)}</span></td>
          <td>${trip.views || 0}</td>
          <td>${formatDate(trip.lastModified)}</td>
          <td><button class="btn btn-sm btn-primary" onclick="openTripInClaude('${escapeHtml(trip.tripId)}', '${escapeHtml(trip.title).replace(/'/g, "\\'")}')">Open in Claude</button></td>
        </tr>
      `).join('')
    : '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);">No trips published yet</td></tr>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  ${getCommonHead('Dashboard', primaryColor)}
</head>
<body>
  ${getNav(subdomain, 'home')}

  <div class="container">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;">
      <h1 class="page-title" style="margin-bottom:0;">Welcome, ${escapeHtml(displayName)}</h1>
      ${subBadge}
    </div>

    <!-- Toast notification -->
    <div id="toast" style="display:none;position:fixed;bottom:2rem;left:50%;transform:translateX(-50%);background:#333;color:white;padding:1rem 1.5rem;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.3);z-index:1000;max-width:90%;text-align:center;">
      <div id="toast-message"></div>
    </div>
    <script>
      function openTripInClaude(tripId, tripTitle) {
        const command = 'use voygent work on trip ' + tripId;
        navigator.clipboard.writeText(command).then(() => {
          showToast('Copied to clipboard: "' + command + '"<br><br>Paste this in Claude to start working on <strong>' + tripTitle + '</strong>');
          setTimeout(() => {
            window.open('https://claude.ai/new', '_blank');
          }, 1500);
        });
      }
      function showToast(message) {
        const toast = document.getElementById('toast');
        document.getElementById('toast-message').innerHTML = message;
        toast.style.display = 'block';
        setTimeout(() => { toast.style.display = 'none'; }, 4000);
      }
    </script>

    <!-- Stats -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">${stats.publishedTrips}</div>
        <div class="stat-label">Published</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.totalViews}</div>
        <div class="stat-label">Total Views</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.viewsLast30Days}</div>
        <div class="stat-label">Views (30d)</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.unreadComments}</div>
        <div class="stat-label">Comments</div>
      </div>
    </div>

    <!-- Publishing Usage Card -->
    <div class="card">
      <div class="card-title">Monthly Publishing</div>
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:1rem;">
        <div>
          <div style="font-size:2rem;font-weight:700;color:var(--primary);">
            ${publishCount} / ${isUnlimited ? '&#8734;' : publishLimit}
          </div>
          <div style="font-size:0.85rem;color:var(--text-muted);">proposals published this month</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:0.75rem;color:var(--text-muted);">Resets</div>
          <div style="font-size:0.9rem;">${periodEnd ? formatDate(periodEnd) : 'N/A'}</div>
        </div>
      </div>
      ${isNearLimit ? '<div class="alert alert-warning" style="margin-top:1rem;">Approaching limit. <a href="https://voygent.somotravel.workers.dev/subscribe?userId=' + escapeHtml(userProfile.userId) + '">Upgrade your plan</a></div>' : ''}
    </div>

    <!-- Recent Trips -->
    <div class="card">
      <div class="card-title">Recent Trips</div>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Status</th>
              <th>Views</th>
              <th>Last Modified</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${recentTripsHtml}
          </tbody>
        </table>
      </div>
      <p style="margin-top:1rem;"><a href="/admin/trips">View all trips →</a></p>
    </div>

    <!-- MCP URL -->
    <div class="card">
      <div class="card-title">MCP Setup</div>
      <p style="font-size:0.9rem;color:var(--text-muted);margin-bottom:0.75rem;">Your MCP URL for Claude Desktop or other clients:</p>
      <div class="copy-box">
        <span style="flex:1;">https://voygent.somotravel.workers.dev?key=${escapeHtml(userProfile.authKey)}</span>
        <button class="copy-box-btn" onclick="navigator.clipboard.writeText('https://voygent.somotravel.workers.dev?key=${escapeHtml(userProfile.authKey)}')">Copy</button>
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Trips page
 */
export function getTripsPageHtml(
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
    viewsTotal: number;
    viewsLast7Days: number;
  }>
): string {
  const primaryColor = userProfile.branding?.primaryColor || '#667eea';

  const tripsHtml = trips.length > 0
    ? trips.map(trip => `
        <tr>
          <td>
            <strong>${escapeHtml(trip.title)}</strong>
            ${trip.destination ? `<br><small style="color:var(--text-muted);">${escapeHtml(trip.destination)}</small>` : ''}
          </td>
          <td><span class="badge badge-info">${escapeHtml(trip.category)}</span></td>
          <td>${trip.viewsTotal}</td>
          <td>${trip.viewsLast7Days}</td>
          <td>${formatDate(trip.publishedAt)}</td>
          <td>
            <a href="/trips/${escapeHtml(trip.filename)}" class="btn btn-sm btn-secondary">View</a>
          </td>
        </tr>
      `).join('')
    : '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:2rem;">No trips published yet. Use Claude to create and publish your first trip.</td></tr>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  ${getCommonHead('Trips', primaryColor)}
</head>
<body>
  ${getNav(subdomain, 'trips')}

  <div class="container">
    <h1 class="page-title">Published Trips</h1>

    <div class="card">
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Status</th>
              <th>Total Views</th>
              <th>Last 7 Days</th>
              <th>Published</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${tripsHtml}
          </tbody>
        </table>
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Comments page
 */
export function getCommentsPageHtml(
  userProfile: UserProfile,
  subdomain: string,
  commentsData: Array<{
    tripId: string;
    tripTitle: string;
    comments: Array<{
      id: string;
      section?: string;
      item?: string;
      message: string;
      name?: string;
      email?: string;
      timestamp: string;
      read?: boolean;
    }>;
  }>
): string {
  const primaryColor = userProfile.branding?.primaryColor || '#667eea';

  let commentsHtml = '';
  if (commentsData.length === 0) {
    commentsHtml = '<div class="card"><p style="text-align:center;color:var(--text-muted);padding:2rem;">No comments yet</p></div>';
  } else {
    for (const trip of commentsData) {
      commentsHtml += `
        <div class="card">
          <div class="card-title">${escapeHtml(trip.tripTitle)}</div>
          ${trip.comments.map(comment => `
            <div style="border-bottom:1px solid var(--border);padding:1rem 0;">
              <div style="display:flex;justify-content:space-between;margin-bottom:0.5rem;">
                <strong>${escapeHtml(comment.name || 'Anonymous')}</strong>
                <span style="color:var(--text-muted);font-size:0.85rem;">${formatDate(comment.timestamp)}</span>
              </div>
              ${comment.section ? `<div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:0.5rem;">On: ${escapeHtml(comment.section)}${comment.item ? ` > ${escapeHtml(comment.item)}` : ''}</div>` : ''}
              <p style="margin:0;">${escapeHtml(comment.message)}</p>
              ${!comment.read ? '<span class="badge badge-warning" style="margin-top:0.5rem;">New</span>' : ''}
            </div>
          `).join('')}
        </div>
      `;
    }
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  ${getCommonHead('Comments', primaryColor)}
</head>
<body>
  ${getNav(subdomain, 'comments')}

  <div class="container">
    <h1 class="page-title">Client Comments</h1>
    <p style="color:var(--text-muted);margin-bottom:1.5rem;">Reply to comments using Claude AI - just say "check comments" in your conversation.</p>
    ${commentsHtml}
  </div>
</body>
</html>`;
}

/**
 * Settings page
 */
export function getSettingsPageHtml(
  userProfile: UserProfile,
  subdomain: string
): string {
  const primaryColor = userProfile.branding?.primaryColor || '#667eea';
  const displayName = userProfile.name || '';
  const agencyName = userProfile.agency?.name || '';
  const email = userProfile.email || '';

  // Subscription info
  const subTier = userProfile.subscription?.tier || 'trial';
  const subStatus = userProfile.subscription?.status || 'unknown';
  const currentPeriodEnd = userProfile.subscription?.currentPeriodEnd
    ? formatDate(userProfile.subscription.currentPeriodEnd)
    : 'N/A';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  ${getCommonHead('Settings', primaryColor)}
</head>
<body>
  ${getNav(subdomain, 'settings')}

  <div class="container">
    <h1 class="page-title">Account Settings</h1>

    <!-- Profile -->
    <div class="card">
      <div class="card-title">Profile</div>
      <form method="POST" action="/admin/settings">
        <div class="form-group">
          <label class="form-label" for="displayName">Display Name</label>
          <input type="text" id="displayName" name="displayName" class="form-input" value="${escapeHtml(displayName)}">
        </div>
        <div class="form-group">
          <label class="form-label" for="agencyName">Agency Name</label>
          <input type="text" id="agencyName" name="agencyName" class="form-input" value="${escapeHtml(agencyName)}">
        </div>
        <div class="form-group">
          <label class="form-label">Email</label>
          <input type="email" class="form-input" value="${escapeHtml(email)}" disabled>
          <p class="form-hint">Contact support to change your email address</p>
        </div>
        <button type="submit" class="btn btn-primary">Save Changes</button>
      </form>
    </div>

    <!-- Subdomain -->
    <div class="card">
      <div class="card-title">Subdomain</div>
      <p style="font-size:0.9rem;margin-bottom:0.75rem;">Your proposals are published at:</p>
      <div class="copy-box">
        <span style="flex:1;">https://${escapeHtml(subdomain)}.voygent.ai</span>
      </div>
      ${subTier === 'trial' ? '<p class="form-hint" style="margin-top:0.75rem;">Upgrade to Pro to choose a custom subdomain</p>' : ''}
    </div>

    <!-- Subscription -->
    <div class="card">
      <div class="card-title">Subscription</div>
      <div style="display:grid;grid-template-columns:auto 1fr;gap:0.5rem 1rem;font-size:0.95rem;">
        <strong>Plan:</strong> <span style="text-transform:capitalize;">${escapeHtml(subTier)}</span>
        <strong>Status:</strong> <span style="text-transform:capitalize;">${escapeHtml(subStatus)}</span>
        <strong>Renews:</strong> <span>${currentPeriodEnd}</span>
      </div>
      <p style="margin-top:1rem;">
        <a href="https://voygent.somotravel.workers.dev/stripe-portal?userId=${escapeHtml(userProfile.userId)}" class="btn btn-secondary btn-sm">Manage Billing</a>
      </p>
    </div>

    <!-- MCP URL -->
    <div class="card">
      <div class="card-title">MCP Setup</div>
      <p style="font-size:0.9rem;color:var(--text-muted);margin-bottom:0.75rem;">Use this URL to connect Claude Desktop or other MCP clients:</p>
      <div class="copy-box">
        <span style="flex:1;">https://voygent.somotravel.workers.dev?key=${escapeHtml(userProfile.authKey)}</span>
        <button class="copy-box-btn" onclick="navigator.clipboard.writeText('https://voygent.somotravel.workers.dev?key=${escapeHtml(userProfile.authKey)}')">Copy</button>
      </div>
      <p class="form-hint" style="margin-top:0.5rem;">Keep this URL private - it grants access to your account</p>
    </div>
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
