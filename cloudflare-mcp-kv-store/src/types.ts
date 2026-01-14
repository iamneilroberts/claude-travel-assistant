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
  created: string;
  lastActive: string;
  status: 'active' | 'inactive' | 'pending' | 'suspended';
  subscription?: SubscriptionInfo;
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
