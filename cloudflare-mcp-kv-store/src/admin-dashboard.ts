/**
 * Admin Dashboard HTML
 * Single-page app for managing users, trips, and support
 */

export const ADMIN_DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Voygent Admin Dashboard</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; color: #333; }
    .header { background: linear-gradient(135deg, #1a5f7a 0%, #0d3d4d 100%); color: white; padding: 20px 30px; }
    .header h1 { font-size: 24px; font-weight: 600; }
    .header p { opacity: 0.8; margin-top: 5px; }
    .nav-tabs { display: flex; gap: 5px; margin-top: 15px; }
    .nav-tab { padding: 8px 16px; background: rgba(255,255,255,0.1); border: none; color: white; border-radius: 6px 6px 0 0; cursor: pointer; font-size: 14px; }
    .nav-tab.active { background: #f5f5f5; color: #1a5f7a; }
    .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
    .tab-content { display: none; }
    .tab-content.active { display: block; }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 20px; }
    .stat-card { background: white; border-radius: 12px; padding: 15px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .stat-card .label { color: #666; font-size: 12px; margin-bottom: 5px; }
    .stat-card .value { font-size: 28px; font-weight: 700; color: #1a5f7a; }
    .section { background: white; border-radius: 12px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); margin-bottom: 20px; }
    .section h2 { font-size: 16px; margin-bottom: 15px; color: #1a5f7a; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { padding: 10px 8px; text-align: left; border-bottom: 1px solid #eee; }
    th { background: #f9f9f9; font-weight: 600; color: #555; position: sticky; top: 0; }
    tr:hover { background: #f5f9fa; }
    tr.clickable { cursor: pointer; }
    .btn { display: inline-block; padding: 6px 12px; border-radius: 6px; text-decoration: none; font-weight: 500; cursor: pointer; border: none; font-size: 13px; }
    .btn-primary { background: #1a5f7a; color: white; }
    .btn-secondary { background: #eee; color: #333; }
    .btn-small { padding: 3px 8px; font-size: 11px; }
    .btn-link { background: none; color: #1a5f7a; padding: 0; text-decoration: underline; }
    .btn:hover { opacity: 0.9; }
    .form-group { margin-bottom: 15px; }
    .form-group label { display: block; margin-bottom: 5px; font-weight: 500; font-size: 13px; }
    .form-group input, .form-group select { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 6px; font-size: 13px; }
    .filter-row { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 15px; align-items: center; }
    .filter-row select, .filter-row input { padding: 6px 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 12px; }
    .modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); justify-content: center; align-items: center; z-index: 1000; }
    .modal.active { display: flex; }
    .modal-content { background: white; border-radius: 12px; padding: 25px; width: 90%; max-width: 500px; max-height: 90vh; overflow-y: auto; }
    .modal-content.wide { max-width: 900px; }
    .modal-content h3 { margin-bottom: 20px; }
    .json-view { background: #1e1e1e; color: #d4d4d4; padding: 15px; border-radius: 8px; font-family: 'Monaco', 'Menlo', monospace; font-size: 11px; white-space: pre-wrap; max-height: 400px; overflow-y: auto; }
    .email-preview { background: #f5f5f5; padding: 15px; border-radius: 8px; font-family: monospace; font-size: 11px; white-space: pre-wrap; max-height: 300px; overflow-y: auto; }
    .badge { display: inline-block; padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: 500; }
    .badge-green { background: #d4edda; color: #155724; }
    .badge-red { background: #f8d7da; color: #721c24; }
    .badge-yellow { background: #fff3cd; color: #856404; }
    .badge-blue { background: #cce5ff; color: #004085; }
    .badge-gray { background: #e9ecef; color: #495057; }
    .comment-box { background: #f8f9fa; border-left: 3px solid #1a5f7a; padding: 10px; margin: 8px 0; border-radius: 0 6px 6px 0; }
    .comment-meta { font-size: 11px; color: #666; margin-bottom: 5px; }
    .link-external { color: #1a5f7a; text-decoration: none; }
    .link-external:hover { text-decoration: underline; }
    .loading { text-align: center; padding: 40px; color: #666; }
    .error { background: #f8d7da; color: #721c24; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
    .detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .detail-section { margin-bottom: 15px; }
    .detail-section h4 { font-size: 13px; color: #666; margin-bottom: 8px; border-bottom: 1px solid #eee; padding-bottom: 5px; }
    .detail-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 12px; }
    .detail-row .label { color: #666; }
    .icon { font-size: 14px; margin-right: 5px; }
    @media (max-width: 768px) { .detail-grid { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>Voygent Admin Dashboard</h1>
    <p>Manage users, trips, and support</p>
    <div class="nav-tabs">
      <button class="nav-tab active" onclick="showTab('overview')">Overview</button>
      <button class="nav-tab" onclick="showTab('trips')">All Trips</button>
      <button class="nav-tab" onclick="showTab('comments')">Comments</button>
      <button class="nav-tab" onclick="showTab('support')">Support</button>
      <button class="nav-tab" onclick="showTab('activity')">Activity</button>
      <button class="nav-tab" onclick="showTab('users')">Users</button>
      <button class="nav-tab" onclick="showTab('billing')">Billing</button>
      <button class="nav-tab" onclick="showTab('messages')">Messages</button>
    </div>
  </div>

  <div class="container">
    <div id="error" class="error" style="display: none;"></div>

    <!-- OVERVIEW TAB -->
    <div id="tab-overview" class="tab-content active">
      <div class="stats-grid">
        <div class="stat-card"><div class="label">Users</div><div class="value" id="totalUsers">-</div></div>
        <div class="stat-card"><div class="label">Trips</div><div class="value" id="totalTrips">-</div></div>
        <div class="stat-card"><div class="label">Comments</div><div class="value" id="totalComments">-</div></div>
        <div class="stat-card"><div class="label">Unread</div><div class="value" id="totalUnread">-</div></div>
      </div>
      <div class="section">
        <h2>Recent Activity</h2>
        <div id="recentActivity"><div class="loading">Loading...</div></div>
      </div>
      <div class="section">
        <h2>Recent Comments</h2>
        <div id="recentComments"><div class="loading">Loading...</div></div>
      </div>
    </div>

    <!-- TRIPS TAB -->
    <div id="tab-trips" class="tab-content">
      <div class="section">
        <div class="filter-row">
          <select id="tripFilterUser" onchange="applyTripFilters()"><option value="">All Users</option></select>
          <select id="tripFilterPhase" onchange="applyTripFilters()">
            <option value="">All Phases</option>
            <option value="discovery">Discovery</option>
            <option value="proposal">Proposal</option>
            <option value="confirmed">Confirmed</option>
          </select>
          <input type="text" id="tripFilterSearch" onkeyup="applyTripFilters()" placeholder="Search trips..." style="width:200px;">
          <span id="tripCount" style="color:#666;font-size:12px;"></span>
        </div>
        <div id="tripsTable" style="max-height:600px;overflow-y:auto;"><div class="loading">Loading...</div></div>
      </div>
    </div>

    <!-- COMMENTS TAB -->
    <div id="tab-comments" class="tab-content">
      <div class="section">
        <div class="filter-row">
          <select id="commentFilterUser" onchange="applyCommentFilters()"><option value="">All Users</option></select>
          <select id="commentFilterRead" onchange="applyCommentFilters()">
            <option value="">All Comments</option>
            <option value="unread">Unread Only</option>
            <option value="read">Read Only</option>
          </select>
          <input type="text" id="commentFilterSearch" onkeyup="applyCommentFilters()" placeholder="Search comments..." style="width:200px;">
          <span id="commentCount" style="color:#666;font-size:12px;"></span>
        </div>
        <div id="commentsTable" style="max-height:600px;overflow-y:auto;"><div class="loading">Loading...</div></div>
      </div>
    </div>

    <!-- SUPPORT TAB -->
    <div id="tab-support" class="tab-content">
      <div class="section">
        <div class="filter-row">
          <select id="supportFilterStatus" onchange="applySupportFilters()">
            <option value="">All Status</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
          </select>
          <select id="supportFilterPriority" onchange="applySupportFilters()">
            <option value="">All Priority</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <span id="supportCount" style="color:#666;font-size:12px;"></span>
        </div>
        <div id="supportTable" style="max-height:600px;overflow-y:auto;"><div class="loading">Loading...</div></div>
      </div>
    </div>

    <!-- ACTIVITY TAB -->
    <div id="tab-activity" class="tab-content">
      <div class="section">
        <div class="filter-row">
          <select id="filterUser" onchange="applyFilters()"><option value="">All Users</option></select>
          <select id="filterTrip" onchange="applyFilters()"><option value="">All Trips</option></select>
          <select id="filterTime" onchange="applyFilters()">
            <option value="">All Time</option>
            <option value="1h">Last Hour</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
          <input type="text" id="filterSearch" onkeyup="applyFilters()" placeholder="Search..." style="width:150px;">
          <span id="activityCount" style="color:#666;font-size:12px;"></span>
        </div>
        <div id="activityList" style="max-height:600px;overflow-y:auto;"><div class="loading">Loading...</div></div>
      </div>
    </div>

    <!-- USERS TAB -->
    <div id="tab-users" class="tab-content">
      <div class="section">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
          <h2>Users</h2>
          <button class="btn btn-primary" onclick="showAddUserModal()">+ Add User</button>
        </div>
        <div id="usersTable"><div class="loading">Loading...</div></div>
      </div>
    </div>

    <!-- BILLING TAB -->
    <div id="tab-billing" class="tab-content">
      <div class="stats-grid">
        <div class="stat-card"><div class="label">Active Subs</div><div class="value" id="activeSubs">-</div></div>
        <div class="stat-card"><div class="label">Trialing</div><div class="value" id="trialingSubs">-</div></div>
        <div class="stat-card"><div class="label">Past Due</div><div class="value" id="pastDueSubs">-</div></div>
        <div class="stat-card"><div class="label">MRR</div><div class="value" id="mrr">-</div></div>
      </div>
      <div class="section">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
          <h2>Promo Codes</h2>
          <button class="btn btn-primary" onclick="showPromoCodeModal()">+ Create Promo Code</button>
        </div>
        <div id="promoCodesTable"><div class="loading">Loading...</div></div>
      </div>
      <div class="section">
        <h2>User Subscriptions</h2>
        <div id="subscriptionsTable"><div class="loading">Loading...</div></div>
      </div>
    </div>

    <!-- MESSAGES TAB -->
    <div id="tab-messages" class="tab-content">
      <div class="stats-grid">
        <div class="stat-card"><div class="label">Active Broadcasts</div><div class="value" id="activeBroadcasts">-</div></div>
        <div class="stat-card"><div class="label">Open Threads</div><div class="value" id="openThreads">-</div></div>
        <div class="stat-card"><div class="label">Unread Replies</div><div class="value" id="unreadReplies">-</div></div>
      </div>
      <div class="section">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
          <h2>Broadcast Announcements</h2>
          <button class="btn btn-primary" onclick="showBroadcastModal()">+ New Broadcast</button>
        </div>
        <div id="broadcastsTable"><div class="loading">Loading...</div></div>
      </div>
      <div class="section">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
          <h2>Direct Message Threads</h2>
          <button class="btn btn-primary" onclick="showDirectMessageModal()">+ New Message</button>
        </div>
        <div class="filter-row">
          <select id="threadFilterUser" onchange="applyThreadFilters()"><option value="">All Users</option></select>
          <select id="threadFilterStatus" onchange="applyThreadFilters()">
            <option value="">All Status</option>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
          </select>
          <select id="threadFilterUnread" onchange="applyThreadFilters()">
            <option value="">All Messages</option>
            <option value="unread">With Unread Replies</option>
          </select>
        </div>
        <div id="threadsTable"><div class="loading">Loading...</div></div>
      </div>
    </div>
  </div>

  <!-- Add User Modal -->
  <div id="addUserModal" class="modal">
    <div class="modal-content">
      <h3>Add New User</h3>
      <form id="addUserForm">
        <div class="form-group"><label>Name *</label><input type="text" id="userName" required></div>
        <div class="form-group"><label>Email *</label><input type="email" id="userEmail" required></div>
        <div class="form-group"><label>Phone</label><input type="tel" id="userPhone"></div>
        <div class="form-group"><label>Agency Name *</label><input type="text" id="agencyName" required></div>
        <div class="form-group"><label>Franchise</label><input type="text" id="agencyFranchise" placeholder="e.g., Cruise Planners"></div>
        <div class="form-group"><label>Website</label><input type="url" id="agencyWebsite"></div>
        <div class="form-group"><label>Booking URL</label><input type="url" id="agencyBookingUrl" placeholder="For client deposits"></div>
        <div class="form-group"><label>Logo URL</label><input type="url" id="agencyLogo"></div>
        <div style="display: flex; gap: 10px; margin-top: 20px;">
          <button type="submit" class="btn btn-primary">Create User</button>
          <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        </div>
      </form>
    </div>
  </div>

  <!-- Edit User Modal -->
  <div id="editUserModal" class="modal">
    <div class="modal-content">
      <h3>Edit User</h3>
      <form id="editUserForm">
        <input type="hidden" id="editUserId">
        <div class="form-group"><label>Name *</label><input type="text" id="editUserName" required></div>
        <div class="form-group"><label>Email *</label><input type="email" id="editUserEmail" required></div>
        <div class="form-group"><label>Phone</label><input type="tel" id="editUserPhone"></div>
        <div class="form-group"><label>Agency Name *</label><input type="text" id="editAgencyName" required></div>
        <div class="form-group"><label>Franchise</label><input type="text" id="editAgencyFranchise" placeholder="e.g., Cruise Planners"></div>
        <div class="form-group"><label>Website</label><input type="url" id="editAgencyWebsite"></div>
        <div class="form-group"><label>Booking URL</label><input type="url" id="editAgencyBookingUrl" placeholder="For client deposits"></div>
        <div class="form-group"><label>Logo URL</label><input type="url" id="editAgencyLogo"></div>
        <div class="form-group">
          <label>Status</label>
          <select id="editUserStatus">
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="pending">Pending</option>
          </select>
        </div>
        <div style="display: flex; gap: 10px; margin-top: 20px;">
          <button type="submit" class="btn btn-primary">Save Changes</button>
          <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        </div>
      </form>
    </div>
  </div>

  <!-- Email Preview Modal -->
  <div id="emailModal" class="modal">
    <div class="modal-content">
      <h3>Setup Email Generated</h3>
      <p style="margin-bottom: 15px;">Send this email to the new user:</p>
      <div class="email-preview" id="emailPreview"></div>
      <div style="display: flex; gap: 10px; margin-top: 20px;">
        <button class="btn btn-primary" onclick="copyEmail()">Copy to Clipboard</button>
        <button class="btn btn-secondary" onclick="closeModal()">Close</button>
      </div>
    </div>
  </div>

  <!-- Trip Detail Modal -->
  <div id="tripDetailModal" class="modal">
    <div class="modal-content wide">
      <h3 id="tripDetailTitle">Trip Details</h3>
      <div id="tripDetailContent"><div class="loading">Loading...</div></div>
      <div style="display: flex; gap: 10px; margin-top: 20px;">
        <button class="btn btn-secondary" onclick="closeModal()">Close</button>
      </div>
    </div>
  </div>

  <!-- Support Detail Modal -->
  <div id="supportDetailModal" class="modal">
    <div class="modal-content wide">
      <h3 id="supportDetailTitle">Support Request</h3>
      <div id="supportDetailContent"><div class="loading">Loading...</div></div>
      <div style="margin-top: 20px;">
        <label style="font-weight:600;display:block;margin-bottom:8px;">Admin Notes / Reply:</label>
        <textarea id="supportAdminNotes" rows="4" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:4px;font-family:inherit;"></textarea>
        <small style="color:#666;">This reply will be shown to the user at the start of their next session.</small>
      </div>
      <div style="display: flex; gap: 10px; margin-top: 20px;">
        <button class="btn btn-primary" onclick="saveSupportNotes()">Save Notes</button>
        <button class="btn btn-secondary" onclick="closeModal()">Close</button>
      </div>
    </div>
  </div>

  <!-- Promo Code Modal -->
  <div id="promoCodeModal" class="modal">
    <div class="modal-content">
      <h3>Create Promo Code</h3>
      <form id="promoCodeForm">
        <div class="form-group">
          <label>Code Name *</label>
          <input type="text" id="promoName" required placeholder="e.g., WELCOME30">
        </div>
        <div class="form-group">
          <label>Discount Type</label>
          <select id="promoType" onchange="togglePromoFields()">
            <option value="percent">Percentage Off</option>
            <option value="amount">Fixed Amount Off ($)</option>
          </select>
        </div>
        <div class="form-group">
          <label>Discount Value *</label>
          <input type="number" id="promoValue" required placeholder="30" min="1">
        </div>
        <div class="form-group">
          <label>Duration</label>
          <select id="promoDuration" onchange="toggleDurationMonths()">
            <option value="once">First Payment Only</option>
            <option value="repeating">Multiple Months</option>
            <option value="forever">Forever</option>
          </select>
        </div>
        <div class="form-group" id="durationMonthsGroup" style="display:none;">
          <label>Number of Months</label>
          <input type="number" id="promoDurationMonths" placeholder="3" min="1" max="24">
        </div>
        <div class="form-group">
          <label>Max Redemptions (optional)</label>
          <input type="number" id="promoMaxRedemptions" placeholder="Unlimited if blank" min="1">
        </div>
        <div style="display: flex; gap: 10px; margin-top: 20px;">
          <button type="submit" class="btn btn-primary">Create Code</button>
          <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        </div>
      </form>
    </div>
  </div>

  <!-- New Broadcast Modal -->
  <div id="broadcastModal" class="modal">
    <div class="modal-content">
      <h3>New Broadcast Announcement</h3>
      <div class="form-group">
        <label>Title *</label>
        <input type="text" id="broadcastTitle" placeholder="Maintenance Notice" required>
      </div>
      <div class="form-group">
        <label>Message *</label>
        <textarea id="broadcastBody" rows="4" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;" placeholder="Your announcement message..."></textarea>
      </div>
      <div class="form-group">
        <label>Priority</label>
        <select id="broadcastPriority">
          <option value="normal">Normal</option>
          <option value="urgent">Urgent</option>
        </select>
      </div>
      <div class="form-group">
        <label>Expires (optional)</label>
        <input type="datetime-local" id="broadcastExpires">
      </div>
      <div style="display: flex; gap: 10px; margin-top: 20px;">
        <button class="btn btn-primary" onclick="createBroadcast()">Send to All Users</button>
        <button class="btn btn-secondary" onclick="closeBroadcastModal()">Cancel</button>
      </div>
    </div>
  </div>

  <!-- New Direct Message Modal -->
  <div id="directMessageModal" class="modal">
    <div class="modal-content">
      <h3>Send Direct Message</h3>
      <div class="form-group">
        <label>Recipient *</label>
        <select id="messageRecipient">
          <option value="">Select user...</option>
        </select>
      </div>
      <div class="form-group">
        <label>Subject *</label>
        <input type="text" id="messageSubject" placeholder="Question about your trip">
      </div>
      <div class="form-group">
        <label>Message *</label>
        <textarea id="messageBody" rows="5" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;" placeholder="Your message..."></textarea>
      </div>
      <div style="display: flex; gap: 10px; margin-top: 20px;">
        <button class="btn btn-primary" onclick="sendDirectMessage()">Send Message</button>
        <button class="btn btn-secondary" onclick="closeDirectMessageModal()">Cancel</button>
      </div>
    </div>
  </div>

  <!-- Thread Detail Modal -->
  <div id="threadDetailModal" class="modal">
    <div class="modal-content" style="max-width:700px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
        <h3 id="threadDetailSubject">Thread Subject</h3>
        <button class="btn btn-secondary btn-small" onclick="closeThreadDetailModal()">Close</button>
      </div>
      <div id="threadMessages" style="max-height:400px;overflow-y:auto;margin-bottom:20px;border:1px solid #eee;border-radius:8px;padding:15px;background:#fafafa;"></div>
      <div style="border-top:1px solid #eee;padding-top:15px;">
        <textarea id="threadReplyBody" rows="3" placeholder="Type your reply..." style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;margin-bottom:10px;"></textarea>
        <div style="display:flex;gap:10px;justify-content:flex-end;">
          <button class="btn btn-secondary" onclick="closeThread()">Close Thread</button>
          <button class="btn btn-primary" onclick="sendThreadReply()">Send Reply</button>
        </div>
      </div>
    </div>
  </div>

  <script>
    const ADMIN_KEY = localStorage.getItem('voygent_admin_key') || prompt('Enter admin key:');
    if (ADMIN_KEY) localStorage.setItem('voygent_admin_key', ADMIN_KEY);

    const API_BASE = window.location.origin;
    let currentEmail = '';
    let usersCache = [];
    let tripsCache = [];
    let commentsCache = [];
    let activityCache = [];

    async function api(endpoint, options = {}) {
      const res = await fetch(API_BASE + endpoint + '?adminKey=' + encodeURIComponent(ADMIN_KEY), {
        ...options,
        headers: { 'Content-Type': 'application/json', ...options.headers }
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'API Error');
      }
      return res.json();
    }

    function showTab(tab) {
      document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      document.querySelector(\`[onclick="showTab('\${tab}')"]\`).classList.add('active');
      document.getElementById('tab-' + tab).classList.add('active');
    }

    async function loadStats() {
      try {
        const data = await api('/admin/stats');
        document.getElementById('totalUsers').textContent = data.totalUsers;
        document.getElementById('totalTrips').textContent = data.totalTrips;
        document.getElementById('totalComments').textContent = data.totalComments;
      } catch (e) {
        showError(e.message);
      }
    }

    async function loadUsers() {
      try {
        const data = await api('/admin/users');
        usersCache = data.users;
        const html = data.users.length ? \`
          <table>
            <thead><tr><th>Name</th><th>Agency</th><th>Email</th><th>Status</th><th>Auth Key</th><th>Actions</th></tr></thead>
            <tbody>
              \${data.users.map(u => \`
                <tr>
                  <td>\${u.name}<span class="user-id">\${u.userId}</span></td>
                  <td>\${u.agency.name}\${u.agency.franchise ? '<br><small style="color:#666">' + u.agency.franchise + '</small>' : ''}</td>
                  <td>\${u.email}\${u.phone ? '<br><small style="color:#666">' + u.phone + '</small>' : ''}</td>
                  <td><span class="status-badge status-\${u.status}">\${u.status}</span></td>
                  <td><code style="font-size:11px">\${u.authKey}</code></td>
                  <td class="actions">
                    <button class="btn btn-secondary btn-small" onclick="editUser('\${u.userId}')">Edit</button>
                  </td>
                </tr>
              \`).join('')}
            </tbody>
          </table>
        \` : '<p>No users yet. Click "Add User" to create one.</p>';
        document.getElementById('usersTable').innerHTML = html;
      } catch (e) {
        document.getElementById('usersTable').innerHTML = '<p class="error">' + e.message + '</p>';
      }
    }

    let activityFilters = { users: [], trips: [] };

    async function loadActivity() {
      try {
        const data = await api('/admin/activity');
        activityCache = data.activities || [];
        activityFilters = data.filters || { users: [], trips: [] };

        // Populate filter dropdowns
        const userSelect = document.getElementById('filterUser');
        userSelect.innerHTML = '<option value="">All Users</option>' +
          activityFilters.users.map(u => \`<option value="\${u.userId}">\${u.name}</option>\`).join('');

        const tripSelect = document.getElementById('filterTrip');
        tripSelect.innerHTML = '<option value="">All Trips</option>' +
          activityFilters.trips.map(t => \`<option value="\${t}">\${t}</option>\`).join('');

        applyFilters();
      } catch (e) {
        document.getElementById('activityList').innerHTML = '<p class="error">' + e.message + '</p>';
      }
    }

    function applyFilters() {
      const userFilter = document.getElementById('filterUser').value;
      const tripFilter = document.getElementById('filterTrip').value;
      const timeFilter = document.getElementById('filterTime').value;
      const searchFilter = document.getElementById('filterSearch').value.toLowerCase();

      let filtered = activityCache;

      // User filter
      if (userFilter) {
        filtered = filtered.filter(a => a.userId === userFilter);
      }

      // Trip filter
      if (tripFilter) {
        filtered = filtered.filter(a => a.tripId === tripFilter);
      }

      // Time filter
      if (timeFilter) {
        const now = Date.now();
        const cutoffs = { '1h': 3600000, '24h': 86400000, '7d': 604800000, '30d': 2592000000 };
        const cutoff = now - (cutoffs[timeFilter] || 0);
        filtered = filtered.filter(a => new Date(a.timestamp).getTime() > cutoff);
      }

      // Search filter
      if (searchFilter) {
        filtered = filtered.filter(a =>
          (a.tripId || '').toLowerCase().includes(searchFilter) ||
          (a.tripName || '').toLowerCase().includes(searchFilter) ||
          (a.change || '').toLowerCase().includes(searchFilter) ||
          (a.userName || '').toLowerCase().includes(searchFilter)
        );
      }

      // Update count
      document.getElementById('activityCount').textContent = \`(\${filtered.length} of \${activityCache.length})\`;

      // Render table
      if (filtered.length === 0) {
        document.getElementById('activityList').innerHTML = '<p style="color:#666;text-align:center;padding:20px;">No activity matches your filters.</p>';
        return;
      }

      const html = \`
        <table>
          <thead>
            <tr>
              <th style="width:160px;">Time</th>
              <th>User</th>
              <th>Trip</th>
              <th>Change</th>
            </tr>
          </thead>
          <tbody>
            \${filtered.slice(0, 100).map(a => \`
              <tr>
                <td style="font-size:12px;color:#666;">\${formatTime(a.timestamp)}</td>
                <td>\${a.userName || a.userId}<br><small style="color:#999;">\${a.agency || ''}</small></td>
                <td><code style="font-size:11px;">\${a.tripId || '-'}</code>\${a.tripName ? '<br><small style="color:#666;">' + a.tripName + '</small>' : ''}</td>
                <td>\${a.change || '-'}</td>
              </tr>
            \`).join('')}
          </tbody>
        </table>
        \${filtered.length > 100 ? '<p style="text-align:center;color:#666;margin-top:10px;">Showing first 100 of ' + filtered.length + ' entries</p>' : ''}
      \`;
      document.getElementById('activityList').innerHTML = html;
    }

    function formatTime(ts) {
      if (!ts) return '-';
      const d = new Date(ts);
      const now = new Date();
      const diff = now.getTime() - d.getTime();

      // Within last hour: "X minutes ago"
      if (diff < 3600000) {
        const mins = Math.floor(diff / 60000);
        return mins <= 1 ? 'Just now' : mins + ' min ago';
      }
      // Within last 24h: "X hours ago"
      if (diff < 86400000) {
        const hours = Math.floor(diff / 3600000);
        return hours + ' hour' + (hours > 1 ? 's' : '') + ' ago';
      }
      // Within last 7 days: "Mon 2:30 PM"
      if (diff < 604800000) {
        return d.toLocaleDateString('en-US', { weekday: 'short' }) + ' ' +
               d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      }
      // Older: "Jan 5, 2:30 PM"
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ', ' +
             d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }

    function showAddUserModal() { document.getElementById('addUserModal').classList.add('active'); }
    function closeModal() { document.querySelectorAll('.modal').forEach(m => m.classList.remove('active')); }
    function showError(msg) { const el = document.getElementById('error'); el.textContent = msg; el.style.display = 'block'; }

    function editUser(userId) {
      const user = usersCache.find(u => u.userId === userId);
      if (!user) { alert('User not found'); return; }

      document.getElementById('editUserId').value = user.userId;
      document.getElementById('editUserName').value = user.name || '';
      document.getElementById('editUserEmail').value = user.email || '';
      document.getElementById('editUserPhone').value = user.phone || '';
      document.getElementById('editAgencyName').value = user.agency?.name || '';
      document.getElementById('editAgencyFranchise').value = user.agency?.franchise || '';
      document.getElementById('editAgencyWebsite').value = user.agency?.website || '';
      document.getElementById('editAgencyBookingUrl').value = user.agency?.bookingUrl || '';
      document.getElementById('editAgencyLogo').value = user.agency?.logo || '';
      document.getElementById('editUserStatus').value = user.status || 'active';

      document.getElementById('editUserModal').classList.add('active');
    }

    document.getElementById('addUserForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const data = await api('/admin/users', {
          method: 'POST',
          body: JSON.stringify({
            name: document.getElementById('userName').value,
            email: document.getElementById('userEmail').value,
            phone: document.getElementById('userPhone').value || undefined,
            agency: {
              name: document.getElementById('agencyName').value,
              franchise: document.getElementById('agencyFranchise').value || undefined,
              website: document.getElementById('agencyWebsite').value || undefined,
              bookingUrl: document.getElementById('agencyBookingUrl').value || undefined,
              logo: document.getElementById('agencyLogo').value || undefined,
            }
          })
        });
        closeModal();
        currentEmail = data.setupEmail.body;
        document.getElementById('emailPreview').textContent = currentEmail;
        document.getElementById('emailModal').classList.add('active');
        loadUsers();
        loadStats();
        document.getElementById('addUserForm').reset();
      } catch (e) {
        alert('Error: ' + e.message);
      }
    });

    document.getElementById('editUserForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const userId = document.getElementById('editUserId').value;
      try {
        await api('/admin/users/' + userId, {
          method: 'PUT',
          body: JSON.stringify({
            name: document.getElementById('editUserName').value,
            email: document.getElementById('editUserEmail').value,
            phone: document.getElementById('editUserPhone').value || undefined,
            status: document.getElementById('editUserStatus').value,
            agency: {
              name: document.getElementById('editAgencyName').value,
              franchise: document.getElementById('editAgencyFranchise').value || undefined,
              website: document.getElementById('editAgencyWebsite').value || undefined,
              bookingUrl: document.getElementById('editAgencyBookingUrl').value || undefined,
              logo: document.getElementById('editAgencyLogo').value || undefined,
            }
          })
        });
        closeModal();
        loadUsers();
        alert('User updated successfully!');
      } catch (e) {
        alert('Error: ' + e.message);
      }
    });

    function copyEmail() {
      navigator.clipboard.writeText(currentEmail);
      alert('Copied to clipboard!');
    }

    // ========== TRIPS ==========
    async function loadTrips() {
      try {
        const data = await api('/admin/trips');
        tripsCache = data.trips || [];

        // Populate user filter
        const users = [...new Set(tripsCache.map(t => JSON.stringify({id: t.userId, name: t.userName})))].map(s => JSON.parse(s));
        document.getElementById('tripFilterUser').innerHTML = '<option value="">All Users</option>' +
          users.map(u => \`<option value="\${u.id}">\${u.name}</option>\`).join('');

        // Update unread count
        const totalUnread = tripsCache.reduce((sum, t) => sum + (t.unreadComments || 0), 0);
        document.getElementById('totalUnread').textContent = totalUnread;

        applyTripFilters();
      } catch (e) {
        document.getElementById('tripsTable').innerHTML = '<p class="error">' + e.message + '</p>';
      }
    }

    function applyTripFilters() {
      const userFilter = document.getElementById('tripFilterUser').value;
      const phaseFilter = document.getElementById('tripFilterPhase').value;
      const searchFilter = document.getElementById('tripFilterSearch').value.toLowerCase();

      let filtered = tripsCache;
      if (userFilter) filtered = filtered.filter(t => t.userId === userFilter);
      if (phaseFilter) filtered = filtered.filter(t => t.meta.phase === phaseFilter);
      if (searchFilter) {
        filtered = filtered.filter(t =>
          t.tripId.toLowerCase().includes(searchFilter) ||
          (t.meta.clientName || '').toLowerCase().includes(searchFilter) ||
          (t.meta.destination || '').toLowerCase().includes(searchFilter) ||
          (t.userName || '').toLowerCase().includes(searchFilter)
        );
      }

      document.getElementById('tripCount').textContent = \`(\${filtered.length} of \${tripsCache.length})\`;

      if (filtered.length === 0) {
        document.getElementById('tripsTable').innerHTML = '<p style="color:#666;text-align:center;padding:20px;">No trips found.</p>';
        return;
      }

      const html = \`<table>
        <thead><tr><th>Trip</th><th>Client</th><th>Agent</th><th>Phase</th><th>Comments</th><th>Published</th><th>Actions</th></tr></thead>
        <tbody>\${filtered.map(t => \`
          <tr class="clickable" onclick="viewTripDetail('\${t.userId}', '\${t.tripId}')">
            <td><code style="font-size:11px;">\${t.tripId}</code><br><small style="color:#666;">\${t.meta.destination || ''}</small></td>
            <td>\${t.meta.clientName || '-'}<br><small style="color:#666;">\${t.meta.dates || ''}</small></td>
            <td>\${t.userName}<br><small style="color:#999;">\${t.agency}</small></td>
            <td><span class="badge badge-\${t.meta.phase === 'confirmed' ? 'green' : t.meta.phase === 'proposal' ? 'blue' : 'gray'}">\${t.meta.phase || '-'}</span></td>
            <td>\${t.commentCount > 0 ? \`<span class="badge \${t.unreadComments > 0 ? 'badge-red' : 'badge-gray'}">\${t.commentCount}\${t.unreadComments > 0 ? ' (' + t.unreadComments + ' new)' : ''}</span>\` : '-'}</td>
            <td>\${t.publishedUrl ? \`<a href="\${t.publishedUrl}" target="_blank" class="link-external" onclick="event.stopPropagation()">View</a>\` : '-'}</td>
            <td><button class="btn btn-small btn-secondary" onclick="event.stopPropagation(); viewTripDetail('\${t.userId}', '\${t.tripId}')">Details</button></td>
          </tr>
        \`).join('')}</tbody>
      </table>\`;
      document.getElementById('tripsTable').innerHTML = html;
    }

    async function viewTripDetail(userId, tripId) {
      document.getElementById('tripDetailModal').classList.add('active');
      document.getElementById('tripDetailContent').innerHTML = '<div class="loading">Loading...</div>';
      document.getElementById('tripDetailTitle').textContent = tripId;

      try {
        const data = await api(\`/admin/trips/\${userId}/\${tripId}\`);
        const meta = data.data?.meta || {};
        const publishedUrl = meta.publishedUrl || (meta.tripId ? \`https://somotravel.us/\${meta.tripId}.html\` : null);

        let html = \`<div class="detail-grid">
          <div>
            <div class="detail-section">
              <h4>Trip Info</h4>
              <div class="detail-row"><span class="label">Client:</span> <span>\${meta.clientName || '-'}</span></div>
              <div class="detail-row"><span class="label">Destination:</span> <span>\${meta.destination || '-'}</span></div>
              <div class="detail-row"><span class="label">Dates:</span> <span>\${meta.dates || '-'}</span></div>
              <div class="detail-row"><span class="label">Phase:</span> <span>\${meta.phase || '-'}</span></div>
              <div class="detail-row"><span class="label">Status:</span> <span>\${meta.status || '-'}</span></div>
              <div class="detail-row"><span class="label">Travelers:</span> <span>\${data.data?.travelers?.count || '-'}</span></div>
            </div>
            <div class="detail-section">
              <h4>Agent</h4>
              <div class="detail-row"><span class="label">Name:</span> <span>\${data.user?.name || userId}</span></div>
              <div class="detail-row"><span class="label">Email:</span> <span>\${data.user?.email || '-'}</span></div>
              <div class="detail-row"><span class="label">Agency:</span> <span>\${data.user?.agency || '-'}</span></div>
            </div>
            \${publishedUrl ? \`<div class="detail-section">
              <h4>Published</h4>
              <a href="\${publishedUrl}" target="_blank" class="link-external">\${publishedUrl}</a>
            </div>\` : ''}
          </div>
          <div>
            <div class="detail-section">
              <h4>Comments (\${data.comments?.length || 0})</h4>
              \${data.comments?.length > 0 ? data.comments.map(c => \`
                <div class="comment-box">
                  <div class="comment-meta">
                    <strong>\${c.section || 'General'}</strong> · \${c.name || 'Anonymous'} · \${formatTime(c.timestamp)}
                    \${c.read ? '<span class="badge badge-gray">Read</span>' : '<span class="badge badge-red">Unread</span>'}
                  </div>
                  <div>\${c.message}</div>
                </div>
              \`).join('') : '<p style="color:#666;">No comments yet.</p>'}
            </div>
            <div class="detail-section">
              <h4>Recent Activity</h4>
              \${data.activity?.length > 0 ? \`<ul style="font-size:12px;color:#666;">\${data.activity.slice(0,10).map(a => \`<li>\${formatTime(a.timestamp)}: \${a.change}</li>\`).join('')}</ul>\` : '<p style="color:#666;">No activity recorded.</p>'}
            </div>
          </div>
        </div>
        <div class="detail-section" style="margin-top:15px;">
          <h4>Raw Data <button class="btn btn-small btn-secondary" onclick="toggleJson()">Toggle</button></h4>
          <div id="jsonData" class="json-view" style="display:none;">\${JSON.stringify(data.data, null, 2)}</div>
        </div>\`;

        document.getElementById('tripDetailContent').innerHTML = html;
      } catch (e) {
        document.getElementById('tripDetailContent').innerHTML = '<p class="error">' + e.message + '</p>';
      }
    }

    function toggleJson() {
      const el = document.getElementById('jsonData');
      el.style.display = el.style.display === 'none' ? 'block' : 'none';
    }

    // ========== COMMENTS ==========
    async function loadComments() {
      try {
        const data = await api('/admin/comments');
        commentsCache = data.comments || [];

        // Populate user filter
        const users = [...new Set(commentsCache.map(c => JSON.stringify({id: c.userId, name: c.userName})))].map(s => JSON.parse(s));
        document.getElementById('commentFilterUser').innerHTML = '<option value="">All Users</option>' +
          users.map(u => \`<option value="\${u.id}">\${u.name}</option>\`).join('');

        applyCommentFilters();
        renderRecentComments();
      } catch (e) {
        document.getElementById('commentsTable').innerHTML = '<p class="error">' + e.message + '</p>';
      }
    }

    function applyCommentFilters() {
      const userFilter = document.getElementById('commentFilterUser').value;
      const readFilter = document.getElementById('commentFilterRead').value;
      const searchFilter = document.getElementById('commentFilterSearch').value.toLowerCase();

      let filtered = commentsCache;
      if (userFilter) filtered = filtered.filter(c => c.userId === userFilter);
      if (readFilter === 'unread') filtered = filtered.filter(c => !c.read);
      if (readFilter === 'read') filtered = filtered.filter(c => c.read);
      if (searchFilter) {
        filtered = filtered.filter(c =>
          (c.message || '').toLowerCase().includes(searchFilter) ||
          (c.tripId || '').toLowerCase().includes(searchFilter) ||
          (c.name || '').toLowerCase().includes(searchFilter) ||
          (c.section || '').toLowerCase().includes(searchFilter)
        );
      }

      document.getElementById('commentCount').textContent = \`(\${filtered.length} of \${commentsCache.length})\`;

      if (filtered.length === 0) {
        document.getElementById('commentsTable').innerHTML = '<p style="color:#666;text-align:center;padding:20px;">No comments found.</p>';
        return;
      }

      const html = \`<table>
        <thead><tr><th>Time</th><th>Trip</th><th>Section</th><th>From</th><th>Message</th><th>Status</th></tr></thead>
        <tbody>\${filtered.map(c => \`
          <tr class="clickable" onclick="viewTripDetail('\${c.userId}', '\${c.tripId}')">
            <td style="font-size:11px;color:#666;">\${formatTime(c.timestamp)}</td>
            <td><code style="font-size:10px;">\${c.tripId}</code><br><small style="color:#999;">\${c.userName}</small></td>
            <td>\${c.section || 'General'}</td>
            <td>\${c.name || 'Anonymous'}\${c.email ? '<br><small style="color:#666;">' + c.email + '</small>' : ''}</td>
            <td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">\${c.message}</td>
            <td>\${c.read ? '<span class="badge badge-gray">Read</span>' : '<span class="badge badge-red">Unread</span>'}</td>
          </tr>
        \`).join('')}</tbody>
      </table>\`;
      document.getElementById('commentsTable').innerHTML = html;
    }

    function renderRecentComments() {
      const recent = commentsCache.slice(0, 5);
      if (recent.length === 0) {
        document.getElementById('recentComments').innerHTML = '<p style="color:#666;">No comments yet.</p>';
        return;
      }
      const html = recent.map(c => \`
        <div class="comment-box" onclick="viewTripDetail('\${c.userId}', '\${c.tripId}')" style="cursor:pointer;">
          <div class="comment-meta">
            <strong>\${c.section || 'General'}</strong> on <code>\${c.tripId}</code> · \${c.name || 'Anonymous'} · \${formatTime(c.timestamp)}
            \${c.read ? '' : '<span class="badge badge-red">New</span>'}
          </div>
          <div>\${c.message}</div>
        </div>
      \`).join('');
      document.getElementById('recentComments').innerHTML = html;
    }

    // ========== ACTIVITY (for Overview) ==========
    function renderRecentActivity() {
      const recent = activityCache.slice(0, 10);
      if (recent.length === 0) {
        document.getElementById('recentActivity').innerHTML = '<p style="color:#666;">No activity yet.</p>';
        return;
      }
      const html = \`<table style="font-size:12px;">
        <tbody>\${recent.map(a => \`
          <tr>
            <td style="width:120px;color:#666;">\${formatTime(a.timestamp)}</td>
            <td>\${a.userName}</td>
            <td><code style="font-size:10px;">\${a.tripId || '-'}</code></td>
            <td>\${a.change || '-'}</td>
          </tr>
        \`).join('')}</tbody>
      </table>\`;
      document.getElementById('recentActivity').innerHTML = html;
    }

    // ========== SUPPORT ==========
    let supportCache = [];

    async function loadSupport() {
      try {
        const data = await api('/admin/support');
        supportCache = data.requests || [];
        applySupportFilters();
      } catch (e) {
        document.getElementById('supportTable').innerHTML = '<p class="error">' + e.message + '</p>';
      }
    }

    function applySupportFilters() {
      const statusFilter = document.getElementById('supportFilterStatus').value;
      const priorityFilter = document.getElementById('supportFilterPriority').value;

      let filtered = supportCache;
      if (statusFilter) filtered = filtered.filter(r => r.status === statusFilter);
      if (priorityFilter) filtered = filtered.filter(r => r.priority === priorityFilter);

      document.getElementById('supportCount').textContent = \`(\${filtered.length} of \${supportCache.length})\`;

      if (filtered.length === 0) {
        document.getElementById('supportTable').innerHTML = '<p style="color:#666;text-align:center;padding:20px;">No support requests.</p>';
        return;
      }

      const priorityColors = { high: 'badge-red', medium: 'badge-yellow', low: 'badge-gray' };
      const statusColors = { open: 'badge-red', in_progress: 'badge-yellow', resolved: 'badge-green' };

      const html = \`<table>
        <thead><tr><th>Time</th><th>User</th><th>Subject</th><th>Priority</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>\${filtered.map(r => \`
          <tr class="clickable" onclick="viewSupportDetail('\${r.id}')" style="cursor:pointer;">
            <td style="font-size:11px;color:#666;">\${formatTime(r.timestamp)}</td>
            <td>\${r.userName || r.userId}\${r.tripId ? '<br><small style="color:#666;">Trip: ' + r.tripId + '</small>' : ''}\${r.adminNotes ? '<br><span class="badge badge-blue" style="font-size:10px;">Has Reply</span>' : ''}</td>
            <td>
              <strong>\${r.subject}</strong>
              \${r.screenshotUrl ? '<button class="btn btn-small btn-secondary" onclick="event.stopPropagation();viewScreenshot(\\'' + r.screenshotUrl + '\\')">View Screenshot</button>' : ''}
              <br><small style="color:#666;max-width:300px;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">\${r.message}</small>
            </td>
            <td><span class="badge \${priorityColors[r.priority] || 'badge-gray'}">\${r.priority}</span></td>
            <td><span class="badge \${statusColors[r.status] || 'badge-gray'}">\${r.status}</span></td>
            <td>
              <select onclick="event.stopPropagation()" onchange="updateSupportStatus('\${r.id}', this.value)" style="padding:4px;font-size:11px;">
                <option value="open" \${r.status === 'open' ? 'selected' : ''}>Open</option>
                <option value="in_progress" \${r.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
                <option value="resolved" \${r.status === 'resolved' ? 'selected' : ''}>Resolved</option>
              </select>
            </td>
          </tr>
        \`).join('')}</tbody>
      </table>\`;
      document.getElementById('supportTable').innerHTML = html;
    }

    function viewScreenshot(url) {
      // Open screenshot URL in new window
      window.open(url, '_blank');
    }

    let currentSupportTicket = null;

    function viewSupportDetail(ticketId) {
      const ticket = supportCache.find(t => t.id === ticketId);
      if (!ticket) return;

      currentSupportTicket = ticket;
      document.getElementById('supportDetailTitle').textContent = ticket.subject;

      const priorityColors = { high: '#dc3545', medium: '#ffc107', low: '#6c757d' };
      const statusColors = { open: '#dc3545', in_progress: '#ffc107', resolved: '#28a745' };

      document.getElementById('supportDetailContent').innerHTML = \`
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px;">
          <div>
            <div style="margin-bottom:10px;"><strong>User:</strong> \${ticket.userName || ticket.userId}</div>
            <div style="margin-bottom:10px;"><strong>Submitted:</strong> \${new Date(ticket.timestamp).toLocaleString()}</div>
            \${ticket.tripId ? '<div style="margin-bottom:10px;"><strong>Trip:</strong> ' + ticket.tripId + '</div>' : ''}
          </div>
          <div>
            <div style="margin-bottom:10px;"><strong>Priority:</strong> <span style="color:\${priorityColors[ticket.priority]};font-weight:600;">\${ticket.priority.toUpperCase()}</span></div>
            <div style="margin-bottom:10px;"><strong>Status:</strong> <span style="color:\${statusColors[ticket.status]};font-weight:600;">\${ticket.status.replace('_', ' ').toUpperCase()}</span></div>
            <div style="margin-bottom:10px;"><strong>Ticket ID:</strong> <code style="font-size:11px;">\${ticket.id}</code></div>
          </div>
        </div>
        <div style="background:#f8f9fa;padding:15px;border-radius:8px;border:1px solid #dee2e6;">
          <strong style="display:block;margin-bottom:10px;">Message:</strong>
          <div style="white-space:pre-wrap;line-height:1.6;">\${ticket.message}</div>
        </div>
        \${ticket.screenshotUrl ? '<div style="margin-top:15px;"><strong>Screenshot:</strong> <a href="' + ticket.screenshotUrl + '" target="_blank">View Image</a></div>' : ''}
      \`;

      document.getElementById('supportAdminNotes').value = ticket.adminNotes || '';
      document.getElementById('supportDetailModal').classList.add('active');
    }

    async function saveSupportNotes() {
      if (!currentSupportTicket) return;

      const notes = document.getElementById('supportAdminNotes').value;
      try {
        await api('/admin/support/' + currentSupportTicket.id, {
          method: 'PUT',
          body: JSON.stringify({ adminNotes: notes })
        });
        alert('Notes saved!');
        loadSupport();
      } catch (e) {
        alert('Error saving notes: ' + e.message);
      }
    }

    async function updateSupportStatus(ticketId, status) {
      try {
        await api('/admin/support/' + ticketId, {
          method: 'PUT',
          body: JSON.stringify({ status })
        });
        loadSupport();
      } catch (e) {
        alert('Error: ' + e.message);
      }
    }

    // ========== BILLING ==========
    let promoCodesCache = [];

    async function loadBillingStats() {
      try {
        const data = await api('/admin/billing-stats');
        document.getElementById('activeSubs').textContent = data.activeSubs || 0;
        document.getElementById('trialingSubs').textContent = data.trialingSubs || 0;
        document.getElementById('pastDueSubs').textContent = data.pastDueSubs || 0;
        document.getElementById('mrr').textContent = '$' + (data.mrr || 0);
      } catch (e) {
        console.error('Failed to load billing stats:', e);
      }
    }

    async function loadPromoCodes() {
      try {
        const data = await api('/admin/promo-codes');
        promoCodesCache = data.codes || [];
        renderPromoCodes();
      } catch (e) {
        document.getElementById('promoCodesTable').innerHTML = '<p class="error">' + e.message + '</p>';
      }
    }

    function renderPromoCodes() {
      if (promoCodesCache.length === 0) {
        document.getElementById('promoCodesTable').innerHTML = '<p style="color:#666;text-align:center;padding:20px;">No promo codes created yet.</p>';
        return;
      }
      const html = \`<table>
        <thead><tr><th>Code</th><th>Discount</th><th>Duration</th><th>Max Uses</th><th>Created</th><th>Actions</th></tr></thead>
        <tbody>\${promoCodesCache.map(c => \`
          <tr>
            <td><code style="background:#f5f5f5;padding:2px 6px;border-radius:4px;">\${c.code}</code></td>
            <td>\${c.percentOff ? c.percentOff + '%' : '$' + c.amountOff} off</td>
            <td>\${c.duration === 'once' ? 'First payment' : c.duration === 'forever' ? 'Forever' : c.duration}</td>
            <td>\${c.maxRedemptions || 'Unlimited'}</td>
            <td style="font-size:11px;color:#666;">\${new Date(c.createdAt).toLocaleDateString()}</td>
            <td>
              <button class="btn btn-small btn-secondary" onclick="copyPromoCode('\${c.code}')">Copy</button>
              <button class="btn btn-small btn-secondary" onclick="deletePromoCode('\${c.code}')" style="color:#dc3545;">Delete</button>
            </td>
          </tr>
        \`).join('')}</tbody>
      </table>\`;
      document.getElementById('promoCodesTable').innerHTML = html;
    }

    function renderSubscriptions() {
      const usersWithSubs = usersCache.filter(u => u.subscription);
      if (usersWithSubs.length === 0) {
        document.getElementById('subscriptionsTable').innerHTML = '<p style="color:#666;text-align:center;padding:20px;">No subscriptions yet.</p>';
        return;
      }
      const statusColors = { active: 'badge-green', trialing: 'badge-blue', past_due: 'badge-red', canceled: 'badge-gray', unpaid: 'badge-yellow' };
      const html = \`<table>
        <thead><tr><th>User</th><th>Agency</th><th>Tier</th><th>Status</th><th>Period End</th><th>Actions</th></tr></thead>
        <tbody>\${usersWithSubs.map(u => \`
          <tr>
            <td>\${u.name}<br><small style="color:#666;">\${u.email}</small></td>
            <td>\${u.agency.name}</td>
            <td>\${u.subscription.tier || 'none'}</td>
            <td><span class="badge \${statusColors[u.subscription.status] || 'badge-gray'}">\${u.subscription.status}</span></td>
            <td style="font-size:11px;">\${u.subscription.currentPeriodEnd ? new Date(u.subscription.currentPeriodEnd).toLocaleDateString() : '-'}</td>
            <td>
              <button class="btn btn-small btn-secondary" onclick="copySubscribeLink('\${u.userId}')">Copy Subscribe Link</button>
            </td>
          </tr>
        \`).join('')}</tbody>
      </table>\`;
      document.getElementById('subscriptionsTable').innerHTML = html;
    }

    function showPromoCodeModal() {
      document.getElementById('promoCodeForm').reset();
      document.getElementById('durationMonthsGroup').style.display = 'none';
      document.getElementById('promoCodeModal').classList.add('active');
    }

    function toggleDurationMonths() {
      const duration = document.getElementById('promoDuration').value;
      document.getElementById('durationMonthsGroup').style.display = duration === 'repeating' ? 'block' : 'none';
    }

    function togglePromoFields() {
      // Future: adjust placeholder or validation based on type
    }

    document.getElementById('promoCodeForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('promoName').value;
      const type = document.getElementById('promoType').value;
      const value = parseInt(document.getElementById('promoValue').value);
      const duration = document.getElementById('promoDuration').value;
      const durationInMonths = document.getElementById('promoDurationMonths').value;
      const maxRedemptions = document.getElementById('promoMaxRedemptions').value;

      try {
        const body = {
          name,
          [type === 'percent' ? 'percentOff' : 'amountOff']: value,
          duration,
          ...(duration === 'repeating' && durationInMonths && { durationInMonths: parseInt(durationInMonths) }),
          ...(maxRedemptions && { maxRedemptions: parseInt(maxRedemptions) })
        };
        await api('/admin/promo-codes', { method: 'POST', body: JSON.stringify(body) });
        closeModal();
        loadPromoCodes();
      } catch (e) {
        alert('Error: ' + e.message);
      }
    });

    function copyPromoCode(code) {
      navigator.clipboard.writeText(code);
      alert('Copied: ' + code);
    }

    function copySubscribeLink(userId) {
      const link = window.location.origin + '/subscribe?userId=' + userId;
      navigator.clipboard.writeText(link);
      alert('Copied subscribe link for user');
    }

    async function deletePromoCode(code) {
      if (!confirm('Delete promo code ' + code + '? This will deactivate it in Stripe.')) return;
      try {
        await api('/admin/promo-codes/' + code, { method: 'DELETE' });
        loadPromoCodes();
      } catch (e) {
        alert('Error: ' + e.message);
      }
    }

    // ========== MESSAGES ==========
    let broadcastsCache = [];
    let threadsCache = [];
    let currentThread = null;

    async function loadMessages() {
      try {
        const data = await api('/admin/messages');
        broadcastsCache = data.broadcasts || [];
        threadsCache = data.directThreads || [];

        document.getElementById('activeBroadcasts').textContent = data.stats.activeBroadcasts;
        document.getElementById('openThreads').textContent = data.stats.openThreads;
        document.getElementById('unreadReplies').textContent = data.stats.unreadUserReplies;

        renderBroadcasts();
        populateThreadUserFilter();
        applyThreadFilters();
      } catch (e) {
        document.getElementById('broadcastsTable').innerHTML = '<p style="color:#c00;">Error: ' + e.message + '</p>';
      }
    }

    function renderBroadcasts() {
      if (broadcastsCache.length === 0) {
        document.getElementById('broadcastsTable').innerHTML = '<p style="color:#666;text-align:center;padding:30px;">No broadcast announcements. Click "+ New Broadcast" to send one to all users.</p>';
        return;
      }

      const html = \`<table>
        <thead><tr><th>Time</th><th>Title</th><th>Priority</th><th>Stats</th><th>Actions</th></tr></thead>
        <tbody>\${broadcastsCache.map(b => \`
          <tr>
            <td style="font-size:11px;">\${formatTime(b.createdAt)}</td>
            <td><strong>\${b.title}</strong><br><small style="color:#666;">\${b.body.length > 80 ? b.body.substring(0, 80) + '...' : b.body}</small></td>
            <td><span class="badge \${b.priority === 'urgent' ? 'badge-red' : 'badge-blue'}">\${b.priority}</span></td>
            <td style="font-size:11px;">\${b.stats.pending} pending / \${b.stats.dismissed} dismissed</td>
            <td><button class="btn btn-small btn-secondary" onclick="deleteBroadcast('\${b.id}')">Delete</button></td>
          </tr>
        \`).join('')}</tbody>
      </table>\`;
      document.getElementById('broadcastsTable').innerHTML = html;
    }

    function populateThreadUserFilter() {
      const select = document.getElementById('threadFilterUser');
      const userIds = [...new Set(threadsCache.map(t => t.userId))];
      select.innerHTML = '<option value="">All Users</option>' +
        userIds.map(uid => {
          const t = threadsCache.find(x => x.userId === uid);
          return \`<option value="\${uid}">\${t?.userName || uid}</option>\`;
        }).join('');
    }

    function applyThreadFilters() {
      const userFilter = document.getElementById('threadFilterUser').value;
      const statusFilter = document.getElementById('threadFilterStatus').value;
      const unreadFilter = document.getElementById('threadFilterUnread').value;

      let filtered = threadsCache;
      if (userFilter) filtered = filtered.filter(t => t.userId === userFilter);
      if (statusFilter) filtered = filtered.filter(t => t.status === statusFilter);
      if (unreadFilter === 'unread') filtered = filtered.filter(t => t.unreadCount > 0);

      renderThreads(filtered);
    }

    function renderThreads(threads) {
      if (threads.length === 0) {
        document.getElementById('threadsTable').innerHTML = '<p style="color:#666;text-align:center;padding:30px;">No message threads. Click "+ New Message" to send a direct message to a user.</p>';
        return;
      }

      const html = \`<table>
        <thead><tr><th>User</th><th>Subject</th><th>Last Message</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>\${threads.map(t => \`
          <tr style="cursor:pointer;" onclick="viewThread('\${t.id}', '\${t.userId}')">
            <td>\${t.userName}\${t.unreadCount > 0 ? '<br><span class="badge badge-red">' + t.unreadCount + ' unread</span>' : ''}</td>
            <td><strong>\${t.subject}</strong><br><small style="color:#666;">\${t.lastMessage?.preview || ''}</small></td>
            <td style="font-size:11px;color:#666;">\${t.lastMessage?.timestamp ? formatTime(t.lastMessage.timestamp) : ''}<br>\${t.lastMessage?.sender === 'user' ? '← User' : '→ Admin'}</td>
            <td><span class="badge \${t.status === 'open' ? 'badge-green' : 'badge-gray'}">\${t.status}</span></td>
            <td><button class="btn btn-small btn-primary" onclick="event.stopPropagation();viewThread('\${t.id}', '\${t.userId}')">View</button></td>
          </tr>
        \`).join('')}</tbody>
      </table>\`;
      document.getElementById('threadsTable').innerHTML = html;
    }

    async function viewThread(threadId, userId) {
      try {
        const data = await api('/admin/messages/thread/' + userId + '/' + threadId);
        currentThread = { ...data.thread, userId };

        document.getElementById('threadDetailSubject').textContent = currentThread.subject + ' (with ' + currentThread.userName + ')';

        const messagesHtml = currentThread.messages.map(m => \`
          <div style="margin-bottom:15px;padding:10px;border-radius:8px;\${m.sender === 'admin' ? 'background:#e3f2fd;margin-left:40px;' : 'background:#fff;margin-right:40px;border:1px solid #ddd;'}">
            <div style="font-size:11px;color:#666;margin-bottom:5px;">
              <strong>\${m.senderName || m.sender}</strong> - \${new Date(m.timestamp).toLocaleString()}
              \${!m.read && m.sender === 'user' ? '<span class="badge badge-red" style="margin-left:5px;">New</span>' : ''}
            </div>
            <div style="white-space:pre-wrap;">\${m.body}</div>
          </div>
        \`).join('');

        document.getElementById('threadMessages').innerHTML = messagesHtml;
        document.getElementById('threadReplyBody').value = '';
        document.getElementById('threadDetailModal').classList.add('active');

        // Mark user messages as read
        await api('/admin/messages/thread/' + userId + '/' + threadId + '/mark-read', { method: 'POST' });
        loadMessages();
      } catch (e) {
        alert('Error loading thread: ' + e.message);
      }
    }

    function showBroadcastModal() {
      document.getElementById('broadcastTitle').value = '';
      document.getElementById('broadcastBody').value = '';
      document.getElementById('broadcastPriority').value = 'normal';
      document.getElementById('broadcastExpires').value = '';
      document.getElementById('broadcastModal').classList.add('active');
    }

    function closeBroadcastModal() {
      document.getElementById('broadcastModal').classList.remove('active');
    }

    async function createBroadcast() {
      const title = document.getElementById('broadcastTitle').value;
      const body = document.getElementById('broadcastBody').value;
      const priority = document.getElementById('broadcastPriority').value;
      const expiresInput = document.getElementById('broadcastExpires').value;

      if (!title || !body) {
        alert('Title and message are required');
        return;
      }

      try {
        await api('/admin/messages/broadcast', {
          method: 'POST',
          body: JSON.stringify({
            title,
            body,
            priority,
            expiresAt: expiresInput ? new Date(expiresInput).toISOString() : null
          })
        });
        closeBroadcastModal();
        loadMessages();
        alert('Broadcast sent to all users!');
      } catch (e) {
        alert('Error: ' + e.message);
      }
    }

    async function deleteBroadcast(broadcastId) {
      if (!confirm('Delete this broadcast? Users who haven\\'t seen it won\\'t receive it.')) return;
      try {
        await api('/admin/messages/broadcast/' + broadcastId, { method: 'DELETE' });
        loadMessages();
      } catch (e) {
        alert('Error: ' + e.message);
      }
    }

    function showDirectMessageModal() {
      // Populate user dropdown
      const select = document.getElementById('messageRecipient');
      select.innerHTML = '<option value="">Select user...</option>' +
        usersCache.map(u => \`<option value="\${u.userId}">\${u.name} (\${u.email || u.userId})</option>\`).join('');
      document.getElementById('messageSubject').value = '';
      document.getElementById('messageBody').value = '';
      document.getElementById('directMessageModal').classList.add('active');
    }

    function closeDirectMessageModal() {
      document.getElementById('directMessageModal').classList.remove('active');
    }

    async function sendDirectMessage() {
      const userId = document.getElementById('messageRecipient').value;
      const subject = document.getElementById('messageSubject').value;
      const body = document.getElementById('messageBody').value;

      if (!userId || !subject || !body) {
        alert('All fields are required');
        return;
      }

      try {
        await api('/admin/messages/direct', {
          method: 'POST',
          body: JSON.stringify({ userId, subject, body })
        });
        closeDirectMessageModal();
        loadMessages();
        alert('Message sent to user!');
      } catch (e) {
        alert('Error: ' + e.message);
      }
    }

    function closeThreadDetailModal() {
      document.getElementById('threadDetailModal').classList.remove('active');
    }

    async function sendThreadReply() {
      if (!currentThread) return;

      const body = document.getElementById('threadReplyBody').value;
      if (!body) {
        alert('Please enter a reply message');
        return;
      }

      try {
        await api('/admin/messages/thread/' + currentThread.userId + '/' + currentThread.id, {
          method: 'PUT',
          body: JSON.stringify({ body })
        });
        viewThread(currentThread.id, currentThread.userId);
      } catch (e) {
        alert('Error: ' + e.message);
      }
    }

    async function closeThread() {
      if (!currentThread) return;
      if (!confirm('Close this thread? The user can still reply to reopen it.')) return;

      try {
        await api('/admin/messages/thread/' + currentThread.userId + '/' + currentThread.id, {
          method: 'PUT',
          body: JSON.stringify({ status: 'closed' })
        });
        closeThreadDetailModal();
        loadMessages();
      } catch (e) {
        alert('Error: ' + e.message);
      }
    }

    // ========== INIT ==========
    async function init() {
      await Promise.all([loadStats(), loadUsers(), loadActivity(), loadTrips(), loadComments(), loadSupport(), loadBillingStats(), loadPromoCodes(), loadMessages()]);
      renderRecentActivity();
      renderSubscriptions();
    }
    init();
  </script>
</body>
</html>`;
