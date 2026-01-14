/**
 * Shared template rendering logic for Voygent
 * Used by both preview_publish and publish_trip tools
 */

import { renderTemplate } from './simple-template';
import { DEFAULT_TEMPLATE } from './default-template';
import type { Env, UserProfile, AgentInfo } from './types';

const DEFAULT_AGENT: AgentInfo = {
  name: 'Travel Agent',
  agency: 'Travel Agency',
};

/**
 * Build agent info from user profile or return defaults
 */
export function buildAgentInfo(userProfile: UserProfile | null): AgentInfo {
  if (!userProfile) return DEFAULT_AGENT;

  return {
    name: userProfile.name,
    email: userProfile.email,
    phone: userProfile.phone,
    agency: userProfile.agency.name,
    franchise: userProfile.agency.franchise,
    logo: userProfile.agency.logo,
    website: userProfile.agency.website,
    bookingUrl: userProfile.agency.bookingUrl,
    primaryColor: userProfile.branding?.primaryColor,
    accentColor: userProfile.branding?.accentColor
  };
}

/**
 * Get template HTML by name
 * Loads from KV first, falls back to DEFAULT_TEMPLATE only if KV entry not found or on error
 */
export async function getTemplateHtml(env: Env, templateName: string): Promise<string> {
  try {
    // Try to load from KV first
    const kvTemplate = await env.TRIPS.get(`_templates/${templateName}`, "text");
    if (kvTemplate) {
      return kvTemplate;
    }
  } catch (err) {
    // KV read failed - fall back to built-in for "default", rethrow for others
    if (templateName !== "default") {
      throw new Error(`Template '${templateName}' failed to load: ${err}`);
    }
    // For "default", continue to built-in fallback below
  }

  // Fall back to built-in default template only for "default"
  if (templateName === "default") {
    return DEFAULT_TEMPLATE;
  }

  throw new Error(`Template '${templateName}' not found.`);
}

/**
 * Build the complete template data object with config and computed values
 */
export function buildTemplateData(
  tripData: any,
  userProfile: UserProfile | null,
  env: Env,
  tripKey: string
): any {
  const tripMeta = tripData.meta || {};
  const agentInfo = buildAgentInfo(userProfile);

  return {
    ...tripData,
    _config: {
      googleMapsApiKey: env.GOOGLE_MAPS_API_KEY,
      showMaps: tripMeta.showMaps !== false,
      showVideos: tripMeta.showVideos !== false,
      tripKey: tripKey,
      apiEndpoint: 'https://voygent.somotravel.workers.dev',
      reserveUrl: tripMeta.reserveUrl || agentInfo.bookingUrl || '',
      agent: agentInfo
    }
  };
}

/**
 * Render trip data to HTML using the specified template
 * This is the main function used by preview_publish and publish_trip
 */
export async function renderTripHtml(
  env: Env,
  tripData: any,
  templateName: string,
  userProfile: UserProfile | null,
  tripKey: string
): Promise<string> {
  const templateHtml = await getTemplateHtml(env, templateName);
  const templateData = buildTemplateData(tripData, userProfile, env, tripKey);
  return renderTemplate(templateHtml, templateData);
}
