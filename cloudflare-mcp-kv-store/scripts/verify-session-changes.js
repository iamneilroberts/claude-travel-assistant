#!/usr/bin/env node

/**
 * Static file verification for session plan changes
 *
 * This script verifies that template files and system prompt have the expected
 * content from the session plan implementations. Run with:
 *
 *   node scripts/verify-session-changes.js
 *
 * Or add to package.json:
 *   "verify-sessions": "node scripts/verify-session-changes.js"
 */

const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');

const checks = [
  // Session 3: cruise.html branding
  {
    name: 'cruise.html has updated header logo URL',
    file: 'src/templates/cruise.html',
    contains: ['voygent.somotravel.workers.dev/media/branding/CPLogoMain.jpg'],
  },
  {
    name: 'cruise.html has updated phone number',
    file: 'src/templates/cruise.html',
    contains: ['251-289-1505', 'tel:+12512891505'],
  },
  {
    name: 'cruise.html has advisor card',
    file: 'src/templates/cruise.html',
    contains: [
      'advisor-card',
      'Kim Henderson',
      'Cruise & Tour Specialist',
      'kim.henderson@cruiseplanners.com',
    ],
  },
  {
    name: 'cruise.html has advisor card CSS',
    file: 'src/templates/cruise.html',
    contains: ['.advisor-card', '.advisor-photo', '.advisor-name'],
  },
  {
    name: 'cruise.html has advisor photo with fallback',
    file: 'src/templates/cruise.html',
    contains: ['kimThumbnail.png', 'advisor-photo-fallback', 'onerror'],
  },

  // Session 3: default.html branding
  {
    name: 'default.html has updated header logo URL',
    file: 'src/templates/default.html',
    contains: ['voygent.somotravel.workers.dev/media/branding/CPLogoMain.jpg'],
  },
  {
    name: 'default.html has updated phone number',
    file: 'src/templates/default.html',
    contains: ['251-289-1505'],
  },
  {
    name: 'default.html has advisor card',
    file: 'src/templates/default.html',
    contains: ['advisor-card', 'Kim Henderson'],
  },
  {
    name: 'default.html has advisor card CSS',
    file: 'src/templates/default.html',
    contains: ['.advisor-card', '.advisor-photo'],
  },

  // Session 3: System prompt enhancements
  {
    name: 'System prompt has port day planning section',
    file: 'prompts/system-prompt.md',
    contains: [
      '### Port Day Planning',
      'Time Analysis Process',
      'Free Time Windows',
    ],
  },
  {
    name: 'System prompt has tour recommendations section',
    file: 'prompts/system-prompt.md',
    contains: [
      '### Tour Recommendations',
      'cruise line excursion',
      'Viator tour',
      'providerType',
    ],
  },
  {
    name: 'System prompt has tour time buffer guidance',
    file: 'prompts/system-prompt.md',
    contains: ['Tour Time Buffer', '1.5 hours before all-aboard'],
  },

  // Session 4: Template cleanup
  {
    name: 'template-renderer.ts does not import DEFAULT_TEMPLATE',
    file: 'src/template-renderer.ts',
    notContains: ['DEFAULT_TEMPLATE', 'default-template'],
  },

  // Session 2: Travel insurance CSS
  {
    name: 'cruise.html has travel insurance CSS',
    file: 'src/templates/cruise.html',
    contains: ['.insurance-options-grid', '.insurance-card'],
  },

  // Session 2: Collapsible sections
  {
    name: 'cruise.html has collapsible section JS',
    file: 'src/templates/cruise.html',
    contains: ['toggleSection', 'collapse-icon'],
  },

  // Session 2: QR code with fallback
  {
    name: 'cruise.html has QR code with fallback',
    file: 'src/templates/cruise.html',
    contains: ['api.qrserver.com', 'chart.googleapis.com', 'onerror'],
  },

  // Session 3: Viator tracking in template-renderer
  {
    name: 'template-renderer.ts has Viator affiliate tracking',
    file: 'src/template-renderer.ts',
    contains: ['addViatorTracking', 'processViatorUrls', 'viator.com'],
  },
];

function runChecks() {
  let passed = 0;
  let failed = 0;
  const results = [];

  for (const check of checks) {
    const filePath = path.join(projectRoot, check.file);

    if (!fs.existsSync(filePath)) {
      results.push(`FAIL: ${check.name} - File not found: ${check.file}`);
      failed++;
      continue;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    let checkPassed = true;
    const errors = [];

    // Check for required content
    if (check.contains) {
      for (const text of check.contains) {
        if (!content.includes(text)) {
          errors.push(`Missing: "${text.slice(0, 50)}${text.length > 50 ? '...' : ''}"`);
          checkPassed = false;
        }
      }
    }

    // Check for forbidden content
    if (check.notContains) {
      for (const text of check.notContains) {
        if (content.includes(text)) {
          errors.push(`Should not contain: "${text}"`);
          checkPassed = false;
        }
      }
    }

    if (checkPassed) {
      results.push(`PASS: ${check.name}`);
      passed++;
    } else {
      results.push(`FAIL: ${check.name}`);
      for (const error of errors) {
        results.push(`      ${error}`);
      }
      failed++;
    }
  }

  return { passed, failed, results };
}

// Main execution
console.log('Session Changes Verification');
console.log('============================\n');

const { passed, failed, results } = runChecks();

for (const result of results) {
  console.log(result);
}

console.log('\n============================');
console.log(`Results: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
}
