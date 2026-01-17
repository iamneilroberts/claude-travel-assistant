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
 * Template resolution order:
 * 1. User-specific template: {keyPrefix}_templates/{name}
 * 2. System template: _templates/{name}
 * 3. Built-in DEFAULT_TEMPLATE (only for "default")
 */
export async function getTemplateHtml(
  env: Env,
  templateName: string,
  keyPrefix?: string
): Promise<string> {
  // 1. Try user-specific template first (if keyPrefix provided)
  if (keyPrefix) {
    try {
      const userTemplate = await env.TRIPS.get(`${keyPrefix}_templates/${templateName}`, "text");
      if (userTemplate) {
        return userTemplate;
      }
    } catch (err) {
      // User template not found or error - continue to system templates
    }
  }

  // 2. Try system template
  try {
    const systemTemplate = await env.TRIPS.get(`_templates/${templateName}`, "text");
    if (systemTemplate) {
      return systemTemplate;
    }
  } catch (err) {
    // System template not found or error - continue to fallback
    if (templateName !== "default") {
      throw new Error(`Template '${templateName}' not found in user or system templates.`);
    }
  }

  // 3. Fall back to built-in DEFAULT_TEMPLATE only for "default"
  if (templateName === "default") {
    return DEFAULT_TEMPLATE;
  }

  throw new Error(`Template '${templateName}' not found.`);
}

/**
 * Resolve which template to use based on user profile and explicit request
 * If no template specified, uses user's default template from profile
 */
export function resolveTemplateName(
  requestedTemplate: string | undefined,
  userProfile: UserProfile | null
): string {
  // If explicitly requested, use that
  if (requestedTemplate && requestedTemplate !== "default") {
    return requestedTemplate;
  }

  // If user has a default template set, use it
  if (userProfile?.template && userProfile.template !== "default") {
    return userProfile.template;
  }

  // Fall back to "default"
  return "default";
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
 *
 * Template resolution:
 * 1. If templateName provided, look for it in: user templates → system templates → built-in
 * 2. If no templateName (or "default"), use userProfile.template as default first
 */
export async function renderTripHtml(
  env: Env,
  tripData: any,
  templateName: string | undefined,
  userProfile: UserProfile | null,
  tripKey: string,
  keyPrefix?: string
): Promise<string> {
  // Resolve which template to use (considers user's default from profile)
  const resolvedTemplate = resolveTemplateName(templateName, userProfile);

  // Get template HTML (checks user templates first, then system, then built-in)
  const templateHtml = await getTemplateHtml(env, resolvedTemplate, keyPrefix);
  const templateData = buildTemplateData(tripData, userProfile, env, tripKey);
  let html = renderTemplate(templateHtml, templateData);

  // Add trial watermark if user is on trial tier
  if (userProfile?.subscription?.tier === 'trial') {
    html = injectTrialWatermark(html);
  }

  return html;
}

/**
 * Inject trial watermark into rendered HTML
 */
function injectTrialWatermark(html: string): string {
  const watermarkHtml = `
<style>
  .voygent-trial-watermark {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    text-align: center;
    padding: 10px 20px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    z-index: 99999;
    box-shadow: 0 -2px 10px rgba(0,0,0,0.1);
  }
  .voygent-trial-watermark a {
    color: white;
    text-decoration: underline;
    font-weight: 600;
  }
</style>
<div class="voygent-trial-watermark">
  Created with Voygent (Trial) &middot; <a href="https://voygent.ai" target="_blank">Start your free trial at voygent.ai</a>
</div>
`;

  // Insert before </body>
  const bodyCloseIndex = html.toLowerCase().lastIndexOf('</body>');
  if (bodyCloseIndex !== -1) {
    return html.slice(0, bodyCloseIndex) + watermarkHtml + html.slice(bodyCloseIndex);
  }

  // If no </body> found, append at the end
  return html + watermarkHtml;
}

/**
 * List available templates for a user
 * Returns both user-specific and system templates
 */
export async function listAvailableTemplates(
  env: Env,
  keyPrefix: string,
  listAllKeys: (env: Env, options: { prefix: string }) => Promise<{ name: string }[]>
): Promise<{ userTemplates: string[]; systemTemplates: string[]; defaultTemplate: string }> {
  // Get user's templates
  const userTemplateKeys = await listAllKeys(env, { prefix: `${keyPrefix}_templates/` });
  const userTemplates = userTemplateKeys
    .map(k => k.name.replace(`${keyPrefix}_templates/`, ""))
    .filter(name => name && !name.startsWith("_"));

  // Get system templates
  const systemTemplateKeys = await listAllKeys(env, { prefix: "_templates/" });
  const systemTemplates = systemTemplateKeys
    .map(k => k.name.replace("_templates/", ""))
    .filter(name => name && !name.startsWith("_"));

  // "default" is always available (built-in fallback)
  if (!systemTemplates.includes("default")) {
    systemTemplates.push("default");
  }

  return {
    userTemplates,
    systemTemplates,
    defaultTemplate: "default" // Built-in is always available
  };
}
