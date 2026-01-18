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
  if (Array.isArray(tripData?.bookings)) {
    const typeLabels: Record<string, { label: string; icon: string }> = {
      cruise: { label: 'Cruise', icon: '🚢' },
      insurance: { label: 'Insurance', icon: '🛡️' },
      flight: { label: 'Flight', icon: '✈️' },
      hotel: { label: 'Hotel', icon: '🏨' }
    };
    const statusLabels: Record<string, { label: string; icon: string; className: string }> = {
      confirmed: { label: 'Confirmed', icon: '✓', className: 'confirmed' },
      quoted: { label: 'Quoted', icon: '⏳', className: 'quoted' },
      pending: { label: 'Pending', icon: '⏳', className: 'pending' },
      cancelled: { label: 'Cancelled', icon: '✗', className: 'cancelled' }
    };

    tripData.bookings = tripData.bookings.map((booking: any) => {
      const typeKey = typeof booking?.type === 'string' ? booking.type.toLowerCase() : '';
      const typeInfo = typeLabels[typeKey] || {
        label: typeKey ? typeKey.charAt(0).toUpperCase() + typeKey.slice(1) : 'Booking',
        icon: '📌'
      };
      const statusKey = typeof booking?.status === 'string' ? booking.status.toLowerCase() : '';
      const statusInfo = statusLabels[statusKey] || {
        label: statusKey ? statusKey.charAt(0).toUpperCase() + statusKey.slice(1) : '',
        icon: '',
        className: statusKey || 'pending'
      };
      const confirmationText = typeof booking?.confirmation === 'string'
        && booking.confirmation.toLowerCase() !== 'quote'
        ? booking.confirmation
        : '';

      // Handle travelers - can be array of strings, array of objects, or JSON string
      let travelersText = '';
      let travelersList = booking?.travelers;
      if (typeof travelersList === 'string') {
        // Try to parse JSON string
        try {
          travelersList = JSON.parse(travelersList);
        } catch {
          travelersText = travelersList; // Use as-is if not JSON
        }
      }
      if (Array.isArray(travelersList)) {
        travelersText = travelersList
          .map((t: any) => typeof t === 'string' ? t : (t?.name || ''))
          .filter(Boolean)
          .join(', ');
      }

      // Sanitize details/notes - don't display raw JSON
      const sanitizeField = (val: any): string => {
        if (typeof val !== 'string') return val;
        const trimmed = val.trim();
        if ((trimmed.startsWith('[') && trimmed.endsWith(']')) ||
            (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
          try {
            JSON.parse(trimmed);
            return ''; // It's valid JSON, don't display
          } catch {
            return val; // Not valid JSON, keep as-is
          }
        }
        return val;
      };
      const sanitizedDetails = sanitizeField(booking?.details);
      const sanitizedNotes = sanitizeField(booking?.notes);

      const balanceValue = booking?.balance;
      const balanceNumber = typeof balanceValue === 'number'
        ? balanceValue
        : (typeof balanceValue === 'string' ? Number(balanceValue) : NaN);
      const showBalance = Number.isFinite(balanceNumber) ? balanceNumber > 0 : !!balanceValue;

      // Remove travelers from spread to prevent template from rendering raw array
      const { travelers: _travelers, ...bookingRest } = booking;
      return {
        ...bookingRest,
        typeLabel: typeInfo.label,
        typeIcon: typeInfo.icon,
        statusLabel: statusInfo.label,
        statusClass: statusInfo.className,
        statusBadge: statusInfo.label ? `${statusInfo.icon} ${statusInfo.label}`.trim() : '',
        confirmationDisplay: confirmationText,
        travelersText,
        showBalance,
        details: sanitizedDetails,
        notes: sanitizedNotes
      };
    });
  }

  if (Array.isArray(tripData?.recommendedExtras)) {
    const priorityOrder: Record<string, number> = {
      high: 0,
      recommended: 1,
      medium: 2,
      splurge: 3
    };
    const badgeLabels: Record<string, string> = {
      high: 'Popular',
      recommended: 'Agent Recommended',
      medium: 'Recommended',
      splurge: 'Upgrade'
    };

    tripData.recommendedExtras = tripData.recommendedExtras
      .map((extra: any) => {
        const priority = typeof extra?.priority === 'string'
          ? extra.priority.toLowerCase()
          : 'medium';
        const normalizedPriority = priorityOrder[priority] === undefined ? 'medium' : priority;
        return {
          ...extra,
          priority: normalizedPriority,
          priorityClass: normalizedPriority,
          badgeLabel: badgeLabels[normalizedPriority] || badgeLabels.medium
        };
      })
      .sort((a: any, b: any) => {
        const aOrder = priorityOrder[a.priority] ?? priorityOrder.medium;
        const bOrder = priorityOrder[b.priority] ?? priorityOrder.medium;
        return aOrder - bOrder;
      });
  }

  // Filter out empty or emoji-only content from itinerary
  if (Array.isArray(tripData?.itinerary)) {
    const hasAlphanumeric = (str: string) => /[a-zA-Z0-9]/.test(str);
    tripData.itinerary = tripData.itinerary.map((day: any) => {
      // Filter activities
      if (Array.isArray(day?.activities)) {
        day.activities = day.activities.filter((act: any) => {
          const name = typeof act?.name === 'string' ? act.name.trim() : '';
          // Keep activity if it has alphanumeric content or meaningful description
          return hasAlphanumeric(name) ||
                 (act?.description && hasAlphanumeric(String(act.description)));
        });
      }
      // Filter lodging - remove if name is empty or emoji-only
      if (day?.lodging) {
        const lodgingName = typeof day.lodging?.name === 'string' ? day.lodging.name.trim() : '';
        if (!hasAlphanumeric(lodgingName)) {
          delete day.lodging;
        }
      }
      // Filter schedule items
      if (Array.isArray(day?.schedule)) {
        day.schedule = day.schedule.filter((item: any) => {
          const activity = typeof item?.activity === 'string' ? item.activity.trim() : '';
          return hasAlphanumeric(activity);
        });
      }
      return day;
    });
  }

  if (tripData?.viatorTours && typeof tripData.viatorTours === 'object') {
    const tours = tripData.viatorTours;
    const byPort = Object.entries(tours)
      .filter(([key, value]) => key !== 'description' && Array.isArray(value))
      .map(([key, value]) => ({
        portKey: key,
        portLabel: key.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
        tours: value
      }));
    tripData.viatorToursByPort = byPort;
    tripData.viatorToursDescription = tours.description || '';
  }

  if (tripData?.cruiseInfo?.cabin && tripData?.images?.cabin) {
    const cabinImages = Array.isArray(tripData.cruiseInfo.cabin.images)
      ? tripData.cruiseInfo.cabin.images
      : [];
    const extraImages = Array.isArray(tripData.images.cabin) ? tripData.images.cabin : [];
    const seen = new Set(
      cabinImages.map((img: any) => img?.urls?.original || img?.url || img).filter(Boolean)
    );
    extraImages.forEach((img: any) => {
      const key = img?.urls?.original || img?.url || img;
      if (key && !seen.has(key)) {
        cabinImages.push(img);
        seen.add(key);
      }
    });
    if (cabinImages.length > 0) {
      tripData.cruiseInfo.cabin.images = cabinImages;
    }
  } else if (tripData?.images?.cabin) {
    if (!tripData.cruiseInfo) tripData.cruiseInfo = {};
    if (!tripData.cruiseInfo.cabin) tripData.cruiseInfo.cabin = {};
    if (!tripData.cruiseInfo.cabin.images) {
      tripData.cruiseInfo.cabin.images = tripData.images.cabin;
    }
  }

  // Deduplicate flightOptions fields that may contain redundant self-booking info
  if (tripData?.flightOptions) {
    const selfBookNote = String(tripData.flightOptions.selfBookNote || '').toLowerCase().trim();
    const disclaimer = String(tripData.flightOptions.disclaimer || '').toLowerCase().trim();
    const notes = String(tripData.flightOptions.notes || '').toLowerCase().trim();

    // Check for self-booking related keywords
    const selfBookKeywords = ['book flights on your own', 'book directly', 'book flights directly', 'self-book', 'book your own'];
    const hasSelfBookInfo = (text: string) => selfBookKeywords.some(kw => text.includes(kw));

    // If selfBookNote exists and disclaimer also mentions self-booking, clear the redundant one
    if (selfBookNote && disclaimer && hasSelfBookInfo(selfBookNote) && hasSelfBookInfo(disclaimer)) {
      // Keep selfBookNote (more specific), clear the self-booking part from disclaimer context
      // Actually, keep disclaimer (more formal) and clear selfBookNote since disclaimer is more comprehensive
      tripData.flightOptions.selfBookNote = '';
    }

    // Also check notes
    if (selfBookNote && notes && hasSelfBookInfo(notes)) {
      tripData.flightOptions.notes = '';
    }
  }

  const tripMeta = tripData.meta || {};
  const agentInfo = buildAgentInfo(userProfile);
  const showTiers = typeof tripMeta.phase === 'string'
    ? tripMeta.phase.toLowerCase() !== 'confirmed'
    : true;

  return {
    ...tripData,
    _config: {
      googleMapsApiKey: env.GOOGLE_MAPS_API_KEY,
      showMaps: tripMeta.showMaps !== false,
      showVideos: tripMeta.showVideos !== false,
      showTiers,
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
  // Resolve which template to use (explicit request → trip meta → user default)
  const tripTemplate = tripData?.meta?.template || tripData?.template;
  const requestedTemplate = (templateName && templateName !== 'default')
    ? templateName
    : (tripTemplate && tripTemplate !== 'default' ? tripTemplate : undefined);
  const resolvedTemplate = resolveTemplateName(requestedTemplate, userProfile);

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
