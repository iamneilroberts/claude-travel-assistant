/**
 * Admin Routes: User management
 * Handles: GET/POST /admin/users, GET/PUT /admin/users/:id
 */

import type { Env, UserProfile, RouteHandler } from '../../types';
import { listAllKeys, getKeyPrefix } from '../../lib/kv';
import { setAuthKeyIndex } from '../../lib/auth';
import { logAdminAction } from '../../lib/audit';

// Generate setup email for new user
function generateSetupEmail(user: UserProfile): { subject: string; body: string } {
  const WORKER_BASE_URL = 'https://voygent.somotravel.workers.dev';
  const mcpUrl = `${WORKER_BASE_URL}/sse?key=${user.authKey}`;

  return {
    subject: `Welcome to Voygent - Your Travel Planning Assistant`,
    body: `Hi ${user.name},

Welcome to Voygent! Your travel planning assistant is ready to use.

== YOUR SETUP KEY ==
${user.authKey}

== SETUP INSTRUCTIONS ==

--- ChatGPT Setup ---
1. Go to ChatGPT Settings > Apps > Advanced settings > Create app
2. Fill in the form:
   - Name: Voygent
   - Description: Voygent AI powered travel assistant
   - MCP Server URL: ${mcpUrl}
   - Authentication: No Auth
3. Check "I understand and want to continue"
4. Click Create
5. Start a new conversation and say "use voygent, list trips"

--- Claude Desktop Setup ---
1. Open your Claude Desktop config file:
   - Mac: ~/Library/Application Support/Claude/claude_desktop_config.json
   - Windows: %APPDATA%/Claude/claude_desktop_config.json
   - Linux: ~/.config/Claude/claude_desktop_config.json

2. Add this to the "mcpServers" section:
{
  "voygent": {
    "command": "npx",
    "args": ["-y", "mcp-remote", "${mcpUrl}"]
  }
}

3. Restart Claude Desktop

Best regards,
The Voygent Team`
  };
}

export const handleListUsers: RouteHandler = async (request, env, ctx, url, corsHeaders) => {
  if (url.pathname !== "/admin/users" || request.method !== "GET") return null;

  const userKeys = await listAllKeys(env, { prefix: "_users/" });
  const users: UserProfile[] = [];

  for (const key of userKeys) {
    const user = await env.TRIPS.get(key.name, "json") as UserProfile;
    if (user) users.push(user);
  }

  return new Response(JSON.stringify({ users }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
};

export const handleCreateUser: RouteHandler = async (request, env, ctx, url, corsHeaders) => {
  if (url.pathname !== "/admin/users" || request.method !== "POST") return null;

  const body = await request.json() as Partial<UserProfile>;

  if (!body.name || !body.email || !body.agency?.name) {
    return new Response(JSON.stringify({ error: "Missing required fields: name, email, agency.name" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  // Generate auth key and userId
  const authKey = `${body.name.split(' ')[0]}.${crypto.randomUUID().slice(0, 8)}`;
  const userId = getKeyPrefix(authKey).slice(0, -1); // Remove trailing slash

  const user: UserProfile = {
    userId,
    authKey,
    name: body.name,
    email: body.email,
    phone: body.phone,
    agency: {
      name: body.agency.name,
      franchise: body.agency.franchise,
      logo: body.agency.logo,
      website: body.agency.website,
      bookingUrl: body.agency.bookingUrl,
    },
    template: body.template || "default",
    branding: body.branding,
    created: new Date().toISOString().split('T')[0],
    lastActive: new Date().toISOString().split('T')[0],
    status: 'active'
  };

  await env.TRIPS.put(`_users/${userId}`, JSON.stringify(user));
  // Set index for O(1) auth key lookups
  await setAuthKeyIndex(env, authKey, userId);

  // Generate setup email content
  const setupEmail = generateSetupEmail(user);

  // Log the action
  const adminKey = request.headers.get('X-Admin-Key') || '';
  await logAdminAction(env, 'create_user', userId, { name: user.name, email: user.email }, adminKey, ctx);

  return new Response(JSON.stringify({ user, setupEmail }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
};

export const handleGetUser: RouteHandler = async (request, env, ctx, url, corsHeaders) => {
  if (!url.pathname.match(/^\/admin\/users\/[^/]+$/) || request.method !== "GET") return null;

  const userId = url.pathname.split('/').pop();
  const user = await env.TRIPS.get(`_users/${userId}`, "json") as UserProfile;

  if (!user) {
    return new Response(JSON.stringify({ error: "User not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  return new Response(JSON.stringify({ user }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
};

export const handleUpdateUser: RouteHandler = async (request, env, ctx, url, corsHeaders) => {
  if (!url.pathname.match(/^\/admin\/users\/[^/]+$/) || request.method !== "PUT") return null;

  const userId = url.pathname.split('/').pop();
  const existing = await env.TRIPS.get(`_users/${userId}`, "json") as UserProfile;

  if (!existing) {
    return new Response(JSON.stringify({ error: "User not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const updates = await request.json() as Partial<UserProfile>;
  const updated: UserProfile = {
    ...existing,
    ...updates,
    userId: existing.userId, // Can't change userId
    authKey: existing.authKey, // Can't change authKey
    agency: { ...existing.agency, ...updates.agency }
  };

  await env.TRIPS.put(`_users/${userId}`, JSON.stringify(updated));

  // Log the action with changed fields
  const adminKey = request.headers.get('X-Admin-Key') || '';
  const changedFields = Object.keys(updates).filter(k => k !== 'agency');
  if (updates.agency) changedFields.push(...Object.keys(updates.agency).map(k => `agency.${k}`));
  await logAdminAction(env, 'update_user', userId!, { changedFields }, adminKey, ctx);

  return new Response(JSON.stringify({ user: updated }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
};
