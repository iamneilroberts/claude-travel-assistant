/**
 * Test suite for session plan changes (Unit Tests)
 * Verifies implementations from:
 * - Session 1: Template Structure & Section Reorganization
 * - Session 2: Template Features & Display Components
 * - Session 3: Viator Tracking & Agent Info
 * - Session 4: Template System Cleanup
 *
 * Note: Static file content verification (templates, system prompt) is done
 * in a separate script: scripts/verify-session-changes.ts
 */

import { describe, it, expect, vi } from 'vitest';
import { buildTemplateData, buildAgentInfo, getTemplateHtml, resolveTemplateName } from '../template-renderer';
import type { Env, UserProfile } from '../types';

// Mock environment
const createMockEnv = (templates: Record<string, string> = {}): Env => ({
  TRIPS: {
    get: vi.fn().mockImplementation((key: string) => {
      if (key.startsWith('_templates/')) {
        const templateName = key.replace('_templates/', '');
        return templates[templateName] || null;
      }
      return null;
    }),
    list: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  } as unknown as KVNamespace,
  MEDIA: {} as R2Bucket,
  AUTH_KEYS: '',
  ADMIN_KEY: '',
  GITHUB_TOKEN: '',
  GITHUB_REPO: '',
  GOOGLE_MAPS_API_KEY: 'test-api-key',
  STRIPE_SECRET_KEY: '',
  STRIPE_WEBHOOK_SECRET: '',
  STRIPE_PUBLISHABLE_KEY: '',
  YOUTUBE_API_KEY: '',
});

// Mock user profile with Viator affiliates
const createMockUserProfile = (overrides: Partial<UserProfile> = {}): UserProfile => ({
  userId: 'test-user',
  authKey: 'Test.abc123',
  name: 'Test User',
  email: 'test@example.com',
  phone: '555-1234',
  agency: {
    name: 'Test Agency',
    franchise: 'Test Franchise',
  },
  created: '2024-01-01',
  lastActive: '2024-01-01',
  status: 'active',
  ...overrides,
});

describe('Session 1: Template Structure', () => {
  describe('buildTemplateData - unified timeline', () => {
    it('creates unifiedTimeline from ports and itinerary', () => {
      const env = createMockEnv();
      const tripData = {
        meta: { clientName: 'Test Client' },
        cruiseInfo: {
          ports: [
            { day: 1, name: 'Athens', arrival: '08:00', departure: '18:00' },
            { day: 2, name: 'Mykonos', arrival: '07:00', departure: '17:00' },
          ],
        },
        itinerary: [
          { day: 1, title: 'Athens Day', activities: [{ name: 'Acropolis Tour' }] },
          { day: 2, title: 'Mykonos Day', activities: [{ name: 'Beach Day' }] },
        ],
      };

      const result = buildTemplateData(tripData, null, env, 'test/trip-1');

      expect(result.unifiedTimeline).toBeDefined();
      expect(Array.isArray(result.unifiedTimeline)).toBe(true);
      expect(result.unifiedTimeline.length).toBeGreaterThan(0);
    });

    it('handles ports at root level', () => {
      const env = createMockEnv();
      const tripData = {
        meta: { clientName: 'Test Client' },
        ports: [
          { day: 1, port: 'Athens' },
          { day: 2, port: 'Santorini' },
        ],
        itinerary: [
          { day: 1, title: 'Athens' },
          { day: 2, title: 'Santorini' },
        ],
      };

      const result = buildTemplateData(tripData, null, env, 'test/trip-1');

      expect(result.unifiedTimeline).toBeDefined();
      expect(result.unifiedTimeline.length).toBeGreaterThanOrEqual(2);
    });

    it('merges activities from itinerary into timeline days', () => {
      const env = createMockEnv();
      const tripData = {
        meta: { clientName: 'Test Client' },
        cruiseInfo: {
          ports: [{ day: 1, name: 'Athens' }],
        },
        itinerary: [
          { day: 1, activities: [{ name: 'Walking Tour', time: '10:00' }] },
        ],
      };

      const result = buildTemplateData(tripData, null, env, 'test/trip-1');

      const day1 = result.unifiedTimeline.find((d: any) => d.dayNumber === 1);
      expect(day1).toBeDefined();
      expect(day1?.activities).toBeDefined();
      expect(day1?.activities?.[0]?.name).toBe('Walking Tour');
    });
  });

  describe('_config flags', () => {
    it('sets showTravelStyle to false by default', () => {
      const env = createMockEnv();
      const tripData = {
        meta: { clientName: 'Test Client' },
      };

      const result = buildTemplateData(tripData, null, env, 'test/trip-1');

      expect(result._config.showTravelStyle).toBe(false);
    });

    it('respects showTravelStyle when explicitly set in meta', () => {
      const env = createMockEnv();
      const tripData = {
        meta: { clientName: 'Test Client', showTravelStyle: true },
      };

      const result = buildTemplateData(tripData, null, env, 'test/trip-1');

      expect(result._config.showTravelStyle).toBe(true);
    });

    it('sets showTiers based on phase', () => {
      const env = createMockEnv();

      // Confirmed phase should hide tiers
      const confirmedTrip = {
        meta: { clientName: 'Test', phase: 'confirmed' },
      };
      const confirmedResult = buildTemplateData(confirmedTrip, null, env, 'test/trip-1');
      expect(confirmedResult._config.showTiers).toBe(false);

      // Proposal phase should show tiers
      const proposalTrip = {
        meta: { clientName: 'Test', phase: 'proposal' },
      };
      const proposalResult = buildTemplateData(proposalTrip, null, env, 'test/trip-2');
      expect(proposalResult._config.showTiers).toBe(true);
    });
  });
});

describe('Session 2: Template Features', () => {
  describe('Travel Insurance Auto-Recommend', () => {
    it('marks middle option as recommended when none is marked', () => {
      const env = createMockEnv();
      const tripData = {
        meta: { clientName: 'Test Client' },
        travelInsurance: {
          options: [
            { planName: 'Basic', price: 50, recommended: false },
            { planName: 'Standard', price: 100, recommended: false },
            { planName: 'Premium', price: 200, recommended: false },
          ],
        },
      };

      const result = buildTemplateData(tripData, null, env, 'test/trip-1');

      // Middle option (index 1) should be marked recommended
      expect(result.travelInsurance.options[1].recommended).toBe(true);
    });

    it('preserves existing recommended flag', () => {
      const env = createMockEnv();
      const tripData = {
        meta: { clientName: 'Test Client' },
        travelInsurance: {
          options: [
            { planName: 'Basic', price: 50, recommended: true },
            { planName: 'Standard', price: 100, recommended: false },
            { planName: 'Premium', price: 200, recommended: false },
          ],
        },
      };

      const result = buildTemplateData(tripData, null, env, 'test/trip-1');

      expect(result.travelInsurance.options[0].recommended).toBe(true);
      expect(result.travelInsurance.options[1].recommended).toBe(false);
    });

    it('handles single option without crashing', () => {
      const env = createMockEnv();
      const tripData = {
        meta: { clientName: 'Test Client' },
        travelInsurance: {
          options: [{ planName: 'Basic', price: 50, recommended: false }],
        },
      };

      // Should not throw
      const result = buildTemplateData(tripData, null, env, 'test/trip-1');
      expect(result.travelInsurance.options).toBeDefined();
    });
  });

  describe('viatorToursByPort Data Shaping', () => {
    it('transforms viatorTours object into viatorToursByPort array', () => {
      const env = createMockEnv();
      const tripData = {
        meta: { clientName: 'Test Client' },
        viatorTours: {
          description: 'Overview of tours',
          athens: [{ name: 'Athens Tour', url: 'https://viator.com/athens' }],
          mykonos: [{ name: 'Mykonos Tour', url: 'https://viator.com/mykonos' }],
        },
      };

      const result = buildTemplateData(tripData, null, env, 'test/trip-1');

      expect(result.viatorToursByPort).toBeDefined();
      expect(Array.isArray(result.viatorToursByPort)).toBe(true);
      expect(result.viatorToursByPort.length).toBe(2);
      expect(result.viatorToursDescription).toBe('Overview of tours');
    });

    it('capitalizes port labels', () => {
      const env = createMockEnv();
      const tripData = {
        meta: { clientName: 'Test Client' },
        viatorTours: {
          'port-louis': [{ name: 'Tour' }],
        },
      };

      const result = buildTemplateData(tripData, null, env, 'test/trip-1');

      const portEntry = result.viatorToursByPort[0];
      expect(portEntry.portLabel).toBe('Port Louis');
    });
  });

  describe('Booking Data Shaping', () => {
    it('adds type labels and icons to bookings', () => {
      const env = createMockEnv();
      const tripData = {
        meta: { clientName: 'Test Client' },
        bookings: [
          { type: 'cruise', confirmation: 'ABC123', status: 'confirmed' },
          { type: 'flight', confirmation: 'XYZ789', status: 'pending' },
        ],
      };

      const result = buildTemplateData(tripData, null, env, 'test/trip-1');

      expect(result.bookings[0].typeLabel).toBe('Cruise');
      expect(result.bookings[0].typeIcon).toBe('🚢');
      expect(result.bookings[0].statusClass).toBe('confirmed');

      expect(result.bookings[1].typeLabel).toBe('Flight');
      expect(result.bookings[1].typeIcon).toBe('✈️');
      expect(result.bookings[1].statusClass).toBe('pending');
    });
  });
});

describe('Session 3: Branding & Viator Tracking', () => {
  describe('Viator Affiliate Tracking', () => {
    const userWithViator = createMockUserProfile({
      affiliates: {
        viator: {
          partnerId: 'P00TEST',
          campaignId: '12345',
        },
      },
    });

    it('adds affiliate params to viatorTours URLs', () => {
      const env = createMockEnv();
      const tripData = {
        meta: { clientName: 'Test Client' },
        viatorTours: {
          athens: [
            { name: 'Athens Tour', url: 'https://www.viator.com/tours/Athens/test' },
          ],
        },
      };

      const result = buildTemplateData(tripData, userWithViator, env, 'test/trip-1');

      const tourUrl = result.viatorTours.athens[0].url;
      expect(tourUrl).toContain('pid=P00TEST');
      expect(tourUrl).toContain('mcid=12345');
      expect(tourUrl).toContain('medium=link');
    });

    it('adds affiliate params to excursions with viator provider', () => {
      const env = createMockEnv();
      const tripData = {
        meta: { clientName: 'Test Client' },
        excursions: [
          { name: 'Viator Tour', provider: 'Viator', url: 'https://www.viator.com/tours/test' },
          { name: 'Cruise Tour', provider: 'Celebrity', url: 'https://celebrity.com/tours' },
        ],
      };

      const result = buildTemplateData(tripData, userWithViator, env, 'test/trip-1');

      expect(result.excursions[0].url).toContain('pid=P00TEST');
      expect(result.excursions[1].url).not.toContain('pid=');
    });

    it('adds affiliate params to recommendedExtras with viator URLs', () => {
      const env = createMockEnv();
      const tripData = {
        meta: { clientName: 'Test Client' },
        recommendedExtras: [
          { name: 'Walking Tour', url: 'https://www.viator.com/tours/walking' },
          { name: 'Hotel', url: 'https://booking.com/hotel' },
        ],
      };

      const result = buildTemplateData(tripData, userWithViator, env, 'test/trip-1');

      expect(result.recommendedExtras[0].url).toContain('pid=P00TEST');
      expect(result.recommendedExtras[1].url).not.toContain('pid=');
    });

    it('does not add tracking if already present', () => {
      const env = createMockEnv();
      const tripData = {
        meta: { clientName: 'Test Client' },
        viatorTours: {
          athens: [
            { name: 'Tour', url: 'https://www.viator.com/tours/test?pid=EXISTING' },
          ],
        },
      };

      const result = buildTemplateData(tripData, userWithViator, env, 'test/trip-1');

      const tourUrl = result.viatorTours.athens[0].url;
      // Should not add another pid
      expect(tourUrl).toBe('https://www.viator.com/tours/test?pid=EXISTING');
    });

    it('does not modify URLs without viator affiliate configured', () => {
      const env = createMockEnv();
      const userWithoutViator = createMockUserProfile({ affiliates: undefined });
      const tripData = {
        meta: { clientName: 'Test Client' },
        viatorTours: {
          athens: [
            { name: 'Tour', url: 'https://www.viator.com/tours/test' },
          ],
        },
      };

      const result = buildTemplateData(tripData, userWithoutViator, env, 'test/trip-1');

      const tourUrl = result.viatorTours.athens[0].url;
      expect(tourUrl).toBe('https://www.viator.com/tours/test');
    });

    it('processes itinerary activities with viator URLs', () => {
      const env = createMockEnv();
      const tripData = {
        meta: { clientName: 'Test Client' },
        itinerary: [
          {
            day: 1,
            activities: [
              { name: 'Viator Tour', url: 'https://www.viator.com/tours/activity' },
            ],
          },
        ],
      };

      const result = buildTemplateData(tripData, userWithViator, env, 'test/trip-1');

      expect(result.itinerary[0].activities[0].url).toContain('pid=P00TEST');
    });
  });

  describe('Agent Info Building', () => {
    it('returns default agent when no profile provided', () => {
      const result = buildAgentInfo(null);

      expect(result.name).toBe('Travel Agent');
      expect(result.agency).toBe('Travel Agency');
    });

    it('builds agent info from user profile', () => {
      const profile = createMockUserProfile({
        name: 'Kim Henderson',
        email: 'kim@example.com',
        phone: '251-289-1505',
        agency: {
          name: 'SoMo Travel',
          franchise: 'Cruise Planners',
          website: 'https://somotravel.com',
        },
      });

      const result = buildAgentInfo(profile);

      expect(result.name).toBe('Kim Henderson');
      expect(result.email).toBe('kim@example.com');
      expect(result.phone).toBe('251-289-1505');
      expect(result.agency).toBe('SoMo Travel');
      expect(result.franchise).toBe('Cruise Planners');
      expect(result.website).toBe('https://somotravel.com');
    });
  });
});

describe('Session 4: Template System Cleanup', () => {
  describe('Template Loading', () => {
    it('throws error when template not found in KV', async () => {
      const env = createMockEnv({}); // No templates in KV

      await expect(getTemplateHtml(env, 'nonexistent')).rejects.toThrow(
        "Template 'nonexistent' not found in KV"
      );
    });

    it('loads template from KV when available', async () => {
      const templateContent = '<html>Test Template</html>';
      const env = createMockEnv({ default: templateContent });

      const result = await getTemplateHtml(env, 'default');

      expect(result).toBe(templateContent);
    });

    it('prefers user template over system template', async () => {
      const systemTemplate = '<html>System</html>';
      const userTemplate = '<html>User</html>';

      const env = {
        ...createMockEnv({ default: systemTemplate }),
        TRIPS: {
          get: vi.fn().mockImplementation((key: string) => {
            if (key === 'user_prefix/_templates/default') return userTemplate;
            if (key === '_templates/default') return systemTemplate;
            return null;
          }),
        } as unknown as KVNamespace,
      };

      const result = await getTemplateHtml(env, 'default', 'user_prefix/');

      expect(result).toBe(userTemplate);
    });
  });

  describe('Template Name Resolution', () => {
    it('uses requested template when provided', () => {
      const profile = createMockUserProfile({ template: 'user-default' });

      const result = resolveTemplateName('cruise', profile);

      expect(result).toBe('cruise');
    });

    it('uses user default template when no request', () => {
      const profile = createMockUserProfile({ template: 'custom-template' });

      const result = resolveTemplateName(undefined, profile);

      expect(result).toBe('custom-template');
    });

    it('falls back to "default" when no template specified', () => {
      const profile = createMockUserProfile({ template: undefined });

      const result = resolveTemplateName(undefined, profile);

      expect(result).toBe('default');
    });

    it('handles "default" request by checking user profile', () => {
      const profile = createMockUserProfile({ template: 'user-favorite' });

      const result = resolveTemplateName('default', profile);

      expect(result).toBe('user-favorite');
    });
  });

  // Note: The verification that template-renderer.ts doesn't import DEFAULT_TEMPLATE
  // is done in scripts/verify-session-changes.ts since we can't use fs in Workers.
});

describe('Session 2: Recommended Extras Priority Sorting', () => {
  it('sorts recommendedExtras by priority', () => {
    const env = createMockEnv();
    const tripData = {
      meta: { clientName: 'Test Client' },
      recommendedExtras: [
        { name: 'Low Priority', priority: 'medium' },
        { name: 'High Priority', priority: 'high' },
        { name: 'Agent Pick', priority: 'recommended' },
        { name: 'Upgrade', priority: 'splurge' },
      ],
    };

    const result = buildTemplateData(tripData, null, env, 'test/trip-1');

    // Should be sorted: high, recommended, medium, splurge
    expect(result.recommendedExtras[0].priority).toBe('high');
    expect(result.recommendedExtras[1].priority).toBe('recommended');
    expect(result.recommendedExtras[2].priority).toBe('medium');
    expect(result.recommendedExtras[3].priority).toBe('splurge');
  });

  it('adds badge labels to recommendedExtras', () => {
    const env = createMockEnv();
    const tripData = {
      meta: { clientName: 'Test Client' },
      recommendedExtras: [
        { name: 'High Priority', priority: 'high' },
        { name: 'Recommended', priority: 'recommended' },
      ],
    };

    const result = buildTemplateData(tripData, null, env, 'test/trip-1');

    expect(result.recommendedExtras[0].badgeLabel).toBe('Popular');
    expect(result.recommendedExtras[1].badgeLabel).toBe('Agent Recommended');
  });
});
