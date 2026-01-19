/**
 * Open Slot Analysis for Pre-Publish Profitability Check
 *
 * Calculates available time per day and identifies opportunities
 * for commissionable tour suggestions.
 */

export interface BookedActivity {
  name: string;
  time?: string;
  duration?: string;
  provider?: string;
}

export interface DaySlotAnalysis {
  day: number;
  date?: string;
  location: string;
  dayType: 'arrival' | 'departure' | 'port' | 'sea' | 'land';
  portHours?: { arrive: string; depart: string; totalHours: number };
  bookedActivities: BookedActivity[];
  bookedHours: number;
  availableHours: number;
  opportunity: 'none' | 'light' | 'moderate' | 'high';
  suggestion?: string;
}

export interface OpenSlotAnalysis {
  tripId: string;
  totalDays: number;
  daysWithOpportunity: number;
  days: DaySlotAnalysis[];
  summary: string;
}

/**
 * Parse time string to hours (24h format)
 * Handles: "08:00", "8:00", "8am", "8:00 AM", "17:00", "5pm"
 */
function parseTimeToHours(time: string | undefined): number | null {
  if (!time) return null;

  const normalized = time.toLowerCase().trim();

  // Handle 24h format: "08:00", "17:30"
  const match24 = normalized.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    return parseInt(match24[1]) + parseInt(match24[2]) / 60;
  }

  // Handle 12h format: "8am", "8:00 am", "5pm", "5:30 pm"
  const match12 = normalized.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
  if (match12) {
    let hours = parseInt(match12[1]);
    const minutes = match12[2] ? parseInt(match12[2]) : 0;
    const period = match12[3];

    if (period === 'pm' && hours !== 12) hours += 12;
    if (period === 'am' && hours === 12) hours = 0;

    return hours + minutes / 60;
  }

  return null;
}

/**
 * Parse duration string to hours
 * Handles: "2h", "2 hours", "2.5h", "2h30m", "half-day", "full-day"
 */
function parseDurationToHours(duration: string | undefined): number {
  if (!duration) return 2; // Default estimate: 2 hours

  const normalized = duration.toLowerCase().trim();

  // Handle "half-day", "full-day"
  if (normalized.includes('half-day') || normalized.includes('half day')) return 4;
  if (normalized.includes('full-day') || normalized.includes('full day')) return 8;

  // Handle "Xh", "X hours", "X.Xh"
  const matchHours = normalized.match(/(\d+(?:\.\d+)?)\s*(?:h|hours?)/);
  if (matchHours) {
    let hours = parseFloat(matchHours[1]);

    // Check for additional minutes: "2h30m"
    const matchMinutes = normalized.match(/(\d+)\s*(?:m|min)/);
    if (matchMinutes) {
      hours += parseInt(matchMinutes[1]) / 60;
    }

    return hours;
  }

  // Handle just minutes: "90 min", "90m"
  const matchMinOnly = normalized.match(/^(\d+)\s*(?:m|min)/);
  if (matchMinOnly) {
    return parseInt(matchMinOnly[1]) / 60;
  }

  return 2; // Default
}

/**
 * Determine day type based on trip structure
 */
function determineDayType(
  dayNum: number,
  totalDays: number,
  portInfo: any,
  isSeaDay: boolean
): 'arrival' | 'departure' | 'port' | 'sea' | 'land' {
  if (dayNum === 1) return 'arrival';
  if (dayNum === totalDays) return 'departure';
  if (isSeaDay) return 'sea';
  if (portInfo?.arrive || portInfo?.depart || portInfo?.arrival || portInfo?.departure) return 'port';
  return 'land';
}

/**
 * Calculate opportunity level based on available hours and day type
 */
function calculateOpportunity(
  dayType: string,
  availableHours: number
): 'none' | 'light' | 'moderate' | 'high' {
  if (dayType === 'arrival' || dayType === 'departure') {
    return availableHours > 4 ? 'light' : 'none';
  }

  if (dayType === 'sea') return 'none';

  if (availableHours >= 6) return 'high';
  if (availableHours >= 4) return 'moderate';
  if (availableHours >= 2) return 'light';
  return 'none';
}

/**
 * Generate suggestion text based on opportunity
 */
function generateSuggestion(
  dayType: string,
  location: string,
  availableHours: number,
  opportunity: string
): string | undefined {
  if (opportunity === 'none') return undefined;

  if (dayType === 'arrival') {
    return `Light activity possible (walking tour, food tour) - avoid exhausting options`;
  }

  if (dayType === 'departure') {
    return `Morning activity possible before departure`;
  }

  if (availableHours >= 6) {
    return `${availableHours.toFixed(1)}h available - full-day or multiple half-day tours possible`;
  }

  if (availableHours >= 4) {
    return `${availableHours.toFixed(1)}h available - half-day tour opportunity`;
  }

  return `${availableHours.toFixed(1)}h available - short tour or activity possible`;
}

/**
 * Normalize location name for matching
 */
function normalizeLocation(location: string): string {
  return location.toLowerCase()
    .replace(/[(),]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Check if a location matches a port (fuzzy match)
 */
function locationMatches(location: string, portName: string): boolean {
  const normLoc = normalizeLocation(location);
  const normPort = normalizeLocation(portName);

  // Direct match
  if (normLoc.includes(normPort) || normPort.includes(normLoc)) return true;

  // Check individual words (e.g., "Kusadasi" matches "Kusadasi (Ephesus)")
  const locWords = normLoc.split(' ');
  const portWords = normPort.split(' ');

  return locWords.some(w => w.length > 3 && portWords.some(pw => pw.includes(w) || w.includes(pw)));
}

/**
 * Analyze trip data for open slots
 */
export function analyzeOpenSlots(tripData: any, tripId: string): OpenSlotAnalysis {
  const days: DaySlotAnalysis[] = [];

  // Get itinerary (array of days)
  const itinerary = tripData.itinerary || [];
  const ports = tripData.ports || tripData.cruiseInfo?.ports || [];
  const totalDays = itinerary.length || ports.length || 1;

  // Get recommendedExtras (Viator tours added at trip level)
  const recommendedExtras = tripData.recommendedExtras || [];

  // Get viatorTours by port
  const viatorTours = tripData.viatorTours || {};

  // Build port lookup by day number or date
  const portByDay: Record<number, any> = {};
  const portByDate: Record<string, any> = {};

  ports.forEach((port: any, idx: number) => {
    if (port.day) portByDay[port.day] = port;
    if (port.date) portByDate[port.date] = port;
  });

  // Analyze each day
  for (let i = 0; i < Math.max(itinerary.length, ports.length, 1); i++) {
    const dayData = itinerary[i] || {};
    const dayNum = dayData.day || i + 1;
    const date = dayData.date;

    // Find port info for this day
    const portInfo = portByDay[dayNum] || (date ? portByDate[date] : null) || ports[i];

    // Determine location
    const location = dayData.location || dayData.port || portInfo?.port ||
                     tripData.meta?.destination || 'Unknown';

    // Check if sea day
    const isSeaDay = location.toLowerCase().includes('at sea') ||
                     location.toLowerCase() === 'sea day' ||
                     portInfo?.isSeaDay;

    // Determine day type
    const dayType = determineDayType(dayNum, totalDays, portInfo, isSeaDay);

    // Calculate port hours if applicable
    let portHours: { arrive: string; depart: string; totalHours: number } | undefined;
    if (dayType === 'port' && portInfo) {
      const arrive = portInfo.arrive || portInfo.arrival;
      const depart = portInfo.depart || portInfo.departure;

      if (arrive && depart) {
        const arriveHours = parseTimeToHours(arrive);
        const departHours = parseTimeToHours(depart);

        if (arriveHours !== null && departHours !== null) {
          portHours = {
            arrive,
            depart,
            totalHours: departHours - arriveHours
          };
        }
      }
    }

    // Collect booked activities
    const bookedActivities: BookedActivity[] = [];
    let bookedHours = 0;

    // Check activities array
    const activities = dayData.activities || [];
    activities.forEach((activity: any) => {
      if (activity.name && !activity.name.toLowerCase().includes('free time')) {
        bookedActivities.push({
          name: activity.name,
          time: activity.time,
          duration: activity.duration,
          provider: activity.provider
        });
        bookedHours += parseDurationToHours(activity.duration);
      }
    });

    // Check excursions array (day-level)
    const excursions = dayData.excursions || [];
    excursions.forEach((exc: any) => {
      if (exc.name) {
        bookedActivities.push({
          name: exc.name,
          time: exc.time,
          duration: exc.duration,
          provider: exc.provider || 'Excursion'
        });
        bookedHours += parseDurationToHours(exc.duration);
      }
    });

    // Check for cruise-included excursions (explicit in data)
    const portIncludedExcursion = portInfo?.includedExcursion || portInfo?.excursion ||
                                   portInfo?.shoreExcursion || portInfo?.included;
    if (portIncludedExcursion && typeof portIncludedExcursion === 'string') {
      bookedActivities.push({
        name: portIncludedExcursion,
        duration: '5h',
        provider: 'Cruise Line (included)'
      });
      bookedHours += 5;
    } else if (portIncludedExcursion && typeof portIncludedExcursion === 'object') {
      bookedActivities.push({
        name: portIncludedExcursion.name || 'Included Excursion',
        duration: portIncludedExcursion.duration || '5h',
        provider: 'Cruise Line (included)'
      });
      bookedHours += parseDurationToHours(portIncludedExcursion.duration) || 5;
    }

    // Detect substantial tours from day highlights/description
    // Look for keywords indicating a major excursion is planned
    const highlights = dayData.highlights || [];
    const dayDescription = dayData.description || dayData.notes || '';
    const allText = [
      ...highlights,
      dayDescription,
      ...(activities.map((a: any) => a.name || '')),
      ...(excursions.map((e: any) => e.name || ''))
    ].join(' ').toLowerCase();

    // Patterns indicating a substantial tour is planned (half-day or full-day)
    const substantialTourPatterns = [
      /\b(full[- ]day|half[- ]day)\s+(tour|excursion|trip)/i,
      /\bincluded\s+(excursion|tour|shore excursion)/i,
      /\b(guided|private)\s+(tour|excursion)\b/i,
      /\bshore excursion\b/i,
      /\bancient (ruins|city|site)\b.*\btour\b/i,
      /\btour\b.*\b(palace|temple|acropolis|ruins)\b/i,
    ];

    const hasSubstantialTourPlanned = substantialTourPatterns.some(pattern => pattern.test(allText));

    // If we detect a substantial tour in the description but haven't counted it yet
    if (hasSubstantialTourPlanned && bookedHours < 3) {
      bookedActivities.push({
        name: 'Planned excursion (from itinerary)',
        duration: '4h',
        provider: 'Detected from highlights'
      });
      bookedHours += 4;
    }

    // Check recommendedExtras for Viator tours matching this port
    recommendedExtras.forEach((extra: any) => {
      if (!extra.name) return;

      // Skip non-tour extras (hotels, drink packages, etc.)
      const isViatorTour = extra.providerType === 'viator' ||
                           extra.provider === 'Viator' ||
                           (extra.url && extra.url.includes('viator.com'));
      if (!isViatorTour) return;

      // Check if this tour matches the current port/location
      const extraName = extra.name.toLowerCase();
      const locationLower = location.toLowerCase();

      // Match by location in name (e.g., "Kleftiko Sea Caves (Milos)" matches "Milos")
      const locationWords = locationLower.replace(/[(),]/g, '').split(/\s+/);
      const matchesLocation = locationWords.some((word: string) =>
        word.length > 3 && extraName.includes(word)
      );

      if (matchesLocation) {
        bookedActivities.push({
          name: extra.name,
          provider: 'Viator (recommended)'
        });
        // Estimate 4 hours for Viator tours unless specified
        bookedHours += 4;
      }
    });

    // Check viatorTours object for this port (if tours already listed by port)
    const portKey = Object.keys(viatorTours).find(key =>
      locationMatches(location, key) && Array.isArray(viatorTours[key])
    );
    if (portKey && viatorTours[portKey]?.length > 0) {
      // If there are port-specific tours listed, count one as likely booked
      const topTour = viatorTours[portKey][0];
      if (topTour && !bookedActivities.some(a => a.name === topTour.name)) {
        bookedActivities.push({
          name: topTour.name,
          provider: 'Viator (suggested)'
        });
        bookedHours += 4;
      }
    }

    // Calculate available hours
    let totalAvailable = portHours?.totalHours || 10; // Default 10 hours for land days
    if (dayType === 'arrival') totalAvailable = 4; // Limited on arrival
    if (dayType === 'departure') totalAvailable = 3; // Very limited on departure
    if (dayType === 'sea') totalAvailable = 0; // No port tours

    const availableHours = Math.max(0, totalAvailable - bookedHours);

    // Determine opportunity level
    const opportunity = calculateOpportunity(dayType, availableHours);

    // Generate suggestion
    const suggestion = generateSuggestion(dayType, location, availableHours, opportunity);

    days.push({
      day: dayNum,
      date,
      location,
      dayType,
      portHours,
      bookedActivities,
      bookedHours,
      availableHours,
      opportunity,
      suggestion
    });
  }

  // Count days with opportunity
  const daysWithOpportunity = days.filter(d => d.opportunity !== 'none').length;

  // Generate summary
  let summary: string;
  if (daysWithOpportunity === 0) {
    summary = 'No open slots identified - itinerary is well-filled or consists of sea/travel days.';
  } else {
    const highOpp = days.filter(d => d.opportunity === 'high').length;
    const modOpp = days.filter(d => d.opportunity === 'moderate').length;
    summary = `${daysWithOpportunity} day(s) with tour opportunities: ${highOpp} high, ${modOpp} moderate. Consider searching for commissionable tours.`;
  }

  return {
    tripId,
    totalDays: days.length,
    daysWithOpportunity,
    days,
    summary
  };
}
