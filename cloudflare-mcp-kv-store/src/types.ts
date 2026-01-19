/**
 * Shared TypeScript types for Voygent MCP Server
 */

export interface Env {
  TRIPS: KVNamespace;
  MEDIA: R2Bucket;
  AUTH_KEYS: string;
  ADMIN_KEY: string;
  GITHUB_TOKEN: string;
  GITHUB_REPO: string;
  GOOGLE_MAPS_API_KEY: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  STRIPE_PUBLISHABLE_KEY: string;
  YOUTUBE_API_KEY: string;
}

export interface UserProfile {
  userId: string;
  authKey: string;
  name: string;
  email: string;
  phone?: string;
  agency: {
    name: string;
    franchise?: string;
    logo?: string;
    website?: string;
    bookingUrl?: string;
  };
  template?: string;
  branding?: {
    primaryColor?: string;
    accentColor?: string;
  };
  affiliates?: AffiliateIds;
  subdomain?: string;  // e.g., "trial-abc123" or "kimstravel"
  created: string;
  lastActive: string;
  status: 'active' | 'inactive' | 'pending' | 'suspended';
  subscription?: SubscriptionInfo;
}

export interface AffiliateIds {
  viator?: {
    partnerId: string;    // pid parameter
    campaignId: string;   // mcid parameter
  };
  getYourGuide?: {
    partnerId: string;
  };
  expedia?: {
    affiliateId: string;
  };
  cruiseWatch?: {
    agentId: string;
  };
  // Add more vendors as needed
}

export interface SubscriptionInfo {
  stripeCustomerId: string;
  stripeSubscriptionId?: string;
  tier: 'trial' | 'starter' | 'professional' | 'agency' | 'none';
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'unpaid';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  trialEnd?: string;
  cancelAtPeriodEnd: boolean;
  publishLimit: number;
  appliedPromoCode?: string;
}

export interface MonthlyUsage {
  userId: string;
  period: string;
  publishCount: number;
  publishedTrips: Array<{
    tripId: string;
    publishedAt: string;
    filename: string;
  }>;
  lastUpdated: string;
}

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  method: string;
  params?: any;
  id?: number | string;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  result?: any;
  error?: { code: number; message: string; data?: any };
  id: number | string | null;
}

export interface AgentInfo {
  name: string;
  email?: string;
  phone?: string;
  agency: string;
  franchise?: string;
  logo?: string;
  website?: string;
  bookingUrl?: string;
  primaryColor?: string;
  accentColor?: string;
}

export interface TemplateConfig {
  googleMapsApiKey: string;
  showMaps: boolean;
  showVideos: boolean;
  tripKey: string;
  apiEndpoint: string;
  reserveUrl: string;
  agent: AgentInfo;
}

/**
 * Route handler signature for HTTP endpoints
 */
export type RouteHandler = (
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  url: URL,
  corsHeaders: Record<string, string>
) => Promise<Response | null>;

/**
 * MCP tool handler signature
 */
export type McpToolHandler = (
  args: Record<string, any>,
  env: Env,
  keyPrefix: string,
  userProfile: UserProfile | null,
  authKey: string,
  ctx?: ExecutionContext
) => Promise<{ content: Array<{ type: string; text: string }> }>;

/**
 * Trip Reference - Source of Truth
 * Contains only confirmed/authoritative data from official sources
 * (cruise line confirmations, hotel bookings, flight tickets, etc.)
 */
export interface TripReference {
  version: number;
  lastUpdated: string;
  sources: ReferenceSource[];
  travelers?: TravelerInfo[];
  dates?: ReferenceDates;
  cruise?: CruiseReference;
  lodging?: LodgingReference[];
  flights?: FlightReference[];
}

export interface ReferenceSource {
  type: 'cruise_confirmation' | 'hotel_confirmation' | 'flight_confirmation' | 'manual_entry' | 'other';
  provider: string;
  date: string;
  reference?: string;
  notes?: string;
}

export interface TravelerInfo {
  name: string;
  dob?: string;
  passportExpiry?: string;
  loyaltyNumbers?: Record<string, string>;
}

export interface ReferenceDates {
  tripStart: string;
  tripEnd: string;
  cruiseStart?: string;
  cruiseEnd?: string;
}

export interface CruiseReference {
  line: string;
  ship: string;
  cabin?: string;
  bookingNumber?: string;
  embarkation: {
    port: string;
    date: string;
    time?: string;
  };
  debarkation: {
    port: string;
    date: string;
    time?: string;
  };
  ports: CruisePortReference[];
}

export interface CruisePortReference {
  date: string;
  port: string;
  country?: string;
  arrive?: string;
  depart?: string;
  isOvernight?: boolean;
  notes?: string;
}

export interface LodgingReference {
  type: 'pre-cruise' | 'post-cruise' | 'mid-trip' | 'hotel';
  name: string;
  location?: string;
  checkIn: string;
  checkOut: string;
  confirmation?: string;
  roomType?: string;
}

export interface FlightReference {
  type: 'outbound' | 'return' | 'connection';
  date: string;
  airline?: string;
  flightNumber?: string;
  from: string;
  to: string;
  departureTime?: string;
  arrivalTime?: string;
  confirmation?: string;
}

/**
 * Validation result when checking trip against reference
 */
export interface ValidationResult {
  valid: boolean;
  checkedAt: string;
  tripId: string;
  hasReference: boolean;
  drift: ValidationDrift[];
  warnings: string[];
  summary: string;
}

export interface ValidationDrift {
  field: string;
  category: 'date' | 'port' | 'traveler' | 'lodging' | 'flight' | 'cruise';
  severity: 'error' | 'warning';
  reference: string | null;
  actual: string | null;
  message: string;
}
