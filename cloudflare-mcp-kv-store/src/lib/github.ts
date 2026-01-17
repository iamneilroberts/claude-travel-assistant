/**
 * GitHub publishing utilities for Voygent MCP Server
 */

import type { Env } from '../types';

// Base URLs
const SITE_BASE_URL = 'https://somotravel.us';

/**
 * Helper to base64 encode strings for GitHub API
 */
export function toBase64(str: string): string {
  return btoa(unescape(encodeURIComponent(str)));
}

/**
 * Publish HTML file to GitHub and update trips.json metadata
 */
export async function publishToGitHub(
  env: Env,
  filename: string,
  htmlContent: string,
  tripMeta: { title: string; dates: string; destination: string; category: string }
): Promise<string> {
  const baseUrl = `https://api.github.com/repos/${env.GITHUB_REPO}/contents`;
  const headers = {
    'Authorization': `token ${env.GITHUB_TOKEN}`,
    'Content-Type': 'application/json',
    'User-Agent': 'Voygent-MCP',
    'Accept': 'application/vnd.github.v3+json'
  };

  // 1. Check if HTML file exists (to get SHA for update)
  let htmlSha: string | null = null;
  const checkUrl = `${baseUrl}/${filename}?ref=main`;
  const checkResponse = await fetch(checkUrl, { headers });
  if (checkResponse.ok) {
    const existing = await checkResponse.json() as any;
    htmlSha = existing.sha;
  } else if (checkResponse.status !== 404) {
    // Unexpected error checking file existence
    const errorText = await checkResponse.text();
    console.error(`Error checking file ${filename}: ${checkResponse.status} - ${errorText}`);
  }
  // 404 = file doesn't exist, that's fine (will create new)

  // 2. Upload/Update HTML file
  const htmlPayload = {
    message: htmlSha ? `Update trip: ${filename}` : `Add trip: ${filename}`,
    content: toBase64(htmlContent),
    branch: 'main',
    ...(htmlSha ? { sha: htmlSha } : {})
  };

  const htmlResponse = await fetch(`${baseUrl}/${filename}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(htmlPayload)
  });

  if (!htmlResponse.ok) {
    const error = await htmlResponse.text();
    throw new Error(`Failed to upload HTML ${filename} (sha: ${htmlSha || 'none'}): ${error}`);
  }

  // 3. Get current trips.json
  let tripsJson: any = { version: 1, trips: [] };
  let tripsSha: string | null = null;

  const tripsResponse = await fetch(`${baseUrl}/trips.json?ref=main`, { headers });
  if (tripsResponse.ok) {
    const tripsData = await tripsResponse.json() as any;
    tripsSha = tripsData.sha;
    // Decode base64 content
    const content = atob(tripsData.content.replace(/\n/g, ''));
    tripsJson = JSON.parse(content);
  } else if (tripsResponse.status !== 404) {
    // Unexpected error getting trips.json
    const errorText = await tripsResponse.text();
    console.error(`Error getting trips.json: ${tripsResponse.status} - ${errorText}`);
  }
  // 404 = trips.json doesn't exist, start fresh

  // 4. Update trips.json with new/updated entry
  const existingIndex = tripsJson.trips.findIndex((t: any) => t.filename === filename);
  const tripEntry = {
    filename,
    title: tripMeta.title,
    dates: tripMeta.dates,
    category: tripMeta.category,
    tags: tripMeta.destination ? [tripMeta.destination] : [],
    lastModified: new Date().toISOString().split('T')[0]
  };

  if (existingIndex >= 0) {
    tripsJson.trips[existingIndex] = tripEntry;
  } else {
    tripsJson.trips.unshift(tripEntry);  // Add to beginning
  }

  // 5. Save updated trips.json
  const tripsPayload = {
    message: `Update trips.json for ${filename}`,
    content: toBase64(JSON.stringify(tripsJson, null, 2)),
    branch: 'main',
    ...(tripsSha ? { sha: tripsSha } : {})
  };

  const tripsUpdateResponse = await fetch(`${baseUrl}/trips.json`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(tripsPayload)
  });

  if (!tripsUpdateResponse.ok) {
    const error = await tripsUpdateResponse.text();
    throw new Error(`Failed to update trips.json (sha: ${tripsSha || 'none'}): ${error}`);
  }

  // Return public URL
  return `${SITE_BASE_URL}/${filename}`;
}

/**
 * Publish HTML file to GitHub drafts/ folder for preview (doesn't update trips.json)
 */
export async function publishDraftToGitHub(
  env: Env,
  filename: string,
  htmlContent: string
): Promise<string> {
  const baseUrl = `https://api.github.com/repos/${env.GITHUB_REPO}/contents`;
  const headers = {
    'Authorization': `token ${env.GITHUB_TOKEN}`,
    'Content-Type': 'application/json',
    'User-Agent': 'Voygent-MCP',
    'Accept': 'application/vnd.github.v3+json'
  };

  // Check if file exists (to get SHA for update)
  let fileSha: string | null = null;
  try {
    const checkResponse = await fetch(`${baseUrl}/${filename}?ref=main`, { headers });
    if (checkResponse.ok) {
      const existing = await checkResponse.json() as any;
      fileSha = existing.sha;
    }
  } catch (_) {
    // File doesn't exist, that's fine
  }

  // Upload/Update HTML file
  const payload = {
    message: fileSha ? `Update draft: ${filename}` : `Add draft: ${filename}`,
    content: toBase64(htmlContent),
    branch: 'main',
    ...(fileSha ? { sha: fileSha } : {})
  };

  const response = await fetch(`${baseUrl}/${filename}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to upload draft: ${error}`);
  }

  // Return public URL
  return `${SITE_BASE_URL}/${filename}`;
}
