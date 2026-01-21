#!/usr/bin/env node

/**
 * validate-urls.js
 *
 * Scans trip JSON data for URLs and validates them by making HTTP HEAD requests.
 * Reports broken links and suspected guessed URLs (those that follow patterns but fail).
 *
 * Usage:
 *   node validate-urls.js <trip-file.json>
 *   node validate-urls.js ../samples/europe-romantic-7day.json
 *
 * Output:
 *   - Console report of URL status
 *   - JSON report file: <trip-file>-url-report.json
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// Rate limiting: delay between requests (ms)
const REQUEST_DELAY = 500;

// Timeout for each request (ms)
const REQUEST_TIMEOUT = 10000;

// Patterns that indicate a guessed URL (not from actual search)
const GUESSED_URL_PATTERNS = [
  // TripAdvisor without proper IDs
  /tripadvisor\.com\/(Hotels|Restaurant|Attraction)[-_][A-Za-z]+[-_]/i,
  /tripadvisor\.com\/[^/]+\/[A-Za-z-]+$/,
  // Missing geo/destination IDs
  /tripadvisor\.com\/[^/]+_Review-(?!g\d+)/,
  // Placeholder or fragment
  /^#$/,
  /^https?:\/\/example\.com/,
  /^https?:\/\/placeholder/,
];

// Patterns for real TripAdvisor URLs
const VALID_TRIPADVISOR_PATTERNS = [
  /tripadvisor\.com\/.*-g\d+-d\d+/,  // Has geo and destination IDs
  /tripadvisor\.com\/.*_Review-g\d+/,  // Has geo ID
];

/**
 * Extract all URLs from a trip object with their paths
 */
function extractUrls(obj, currentPath = '') {
  const urls = [];

  if (!obj || typeof obj !== 'object') return urls;

  if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      urls.push(...extractUrls(item, `${currentPath}[${index}]`));
    });
    return urls;
  }

  for (const [key, value] of Object.entries(obj)) {
    const newPath = currentPath ? `${currentPath}.${key}` : key;

    // Check for URL fields - include image fields as they also contain URLs
    const urlKeys = ['url', 'website', 'bookingUrl', 'shipUrl', 'deckPlanUrl',
                     'stateroomUrl', 'image', 'thumbnail', 'heroImage', 'logo',
                     'photo', 'src'];
    if (urlKeys.includes(key)) {
      if (typeof value === 'string' && value.trim()) {
        urls.push({ path: newPath, url: value, context: obj.name || obj.title || 'unknown' });
      }
    } else if (typeof value === 'object') {
      urls.push(...extractUrls(value, newPath));
    }
  }

  return urls;
}

/**
 * Check if URL looks like it was guessed rather than from a real search
 */
function detectGuessedUrl(url) {
  // Check against guessed patterns
  for (const pattern of GUESSED_URL_PATTERNS) {
    if (pattern.test(url)) {
      return { likely: true, reason: 'Matches guessed URL pattern' };
    }
  }

  // For TripAdvisor URLs, check if they have proper IDs
  if (url.includes('tripadvisor.com')) {
    const hasValidPattern = VALID_TRIPADVISOR_PATTERNS.some(p => p.test(url));
    if (!hasValidPattern) {
      return { likely: true, reason: 'TripAdvisor URL missing geo/destination IDs (g######-d######)' };
    }
  }

  return { likely: false, reason: null };
}

/**
 * Make HTTP request to check if URL exists
 * Uses HEAD first, falls back to GET on 403/405 (many sites block HEAD)
 */
function checkUrl(url, method = 'HEAD') {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http;

    // Skip placeholder URLs
    if (url === '#' || url.startsWith('#')) {
      resolve({
        status: 'placeholder',
        code: null,
        error: 'Placeholder URL (#)'
      });
      return;
    }

    try {
      const urlObj = new URL(url);

      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: method,
        timeout: REQUEST_TIMEOUT,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      };

      const req = client.request(options, (res) => {
        const code = res.statusCode;

        // Consume response body to prevent memory leaks (for GET requests)
        res.resume();

        if (code >= 200 && code < 400) {
          resolve({ status: 'ok', code, error: null });
        } else if ((code === 403 || code === 405) && method === 'HEAD') {
          // Many sites block HEAD requests - retry with GET
          checkUrl(url, 'GET').then(resolve);
        } else if (code >= 400 && code < 500) {
          resolve({ status: 'broken', code, error: `HTTP ${code}` });
        } else if (code >= 500) {
          resolve({ status: 'server_error', code, error: `HTTP ${code}` });
        } else {
          resolve({ status: 'redirect', code, error: null });
        }
      });

      req.on('error', (err) => {
        // On HEAD error, try GET as fallback
        if (method === 'HEAD') {
          checkUrl(url, 'GET').then(resolve);
        } else {
          resolve({ status: 'error', code: null, error: err.message });
        }
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({ status: 'timeout', code: null, error: 'Request timed out' });
      });

      req.end();
    } catch (err) {
      resolve({ status: 'invalid', code: null, error: err.message });
    }
  });
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Main validation function
 */
async function validateTripUrls(tripFile) {
  // Read and parse trip file
  let tripData;
  try {
    const content = fs.readFileSync(tripFile, 'utf-8');
    tripData = JSON.parse(content);
  } catch (err) {
    console.error(`Error reading trip file: ${err.message}`);
    process.exit(1);
  }

  const tripId = tripData.meta?.tripId || path.basename(tripFile, '.json');
  console.log(`\nValidating URLs in: ${tripId}`);
  console.log('='.repeat(60));

  // Extract all URLs
  const urls = extractUrls(tripData);
  console.log(`Found ${urls.length} URLs to validate\n`);

  if (urls.length === 0) {
    console.log('No URLs found in trip data.');
    return;
  }

  const results = {
    tripId,
    file: tripFile,
    timestamp: new Date().toISOString(),
    summary: { total: urls.length, ok: 0, broken: 0, guessed: 0, error: 0 },
    urls: [],
  };

  // Validate each URL
  for (let i = 0; i < urls.length; i++) {
    const { path: urlPath, url, context } = urls[i];

    process.stdout.write(`[${i + 1}/${urls.length}] ${context}: `);

    // Check if URL looks guessed
    const guessCheck = detectGuessedUrl(url);

    // Check if URL is accessible
    const httpCheck = await checkUrl(url);

    const result = {
      path: urlPath,
      url,
      context,
      status: httpCheck.status,
      httpCode: httpCheck.code,
      error: httpCheck.error,
      likelyGuessed: guessCheck.likely,
      guessReason: guessCheck.reason,
    };

    results.urls.push(result);

    // Update summary
    if (httpCheck.status === 'ok') {
      results.summary.ok++;
      process.stdout.write('\x1b[32mOK\x1b[0m');
    } else if (httpCheck.status === 'broken') {
      results.summary.broken++;
      process.stdout.write(`\x1b[31mBROKEN (${httpCheck.code})\x1b[0m`);
    } else {
      results.summary.error++;
      process.stdout.write(`\x1b[33m${httpCheck.status.toUpperCase()}\x1b[0m`);
    }

    if (guessCheck.likely) {
      results.summary.guessed++;
      process.stdout.write(' \x1b[35m[LIKELY GUESSED]\x1b[0m');
    }

    console.log();

    // Rate limiting
    if (i < urls.length - 1) {
      await sleep(REQUEST_DELAY);
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total URLs:      ${results.summary.total}`);
  console.log(`\x1b[32mValid:           ${results.summary.ok}\x1b[0m`);
  console.log(`\x1b[31mBroken:          ${results.summary.broken}\x1b[0m`);
  console.log(`\x1b[33mErrors:          ${results.summary.error}\x1b[0m`);
  console.log(`\x1b[35mLikely Guessed:  ${results.summary.guessed}\x1b[0m`);

  // List problematic URLs
  const problems = results.urls.filter(u => u.status !== 'ok' || u.likelyGuessed);
  if (problems.length > 0) {
    console.log('\n' + '='.repeat(60));
    console.log('URLS NEEDING ATTENTION');
    console.log('='.repeat(60));

    for (const p of problems) {
      console.log(`\nPath: ${p.path}`);
      console.log(`Context: ${p.context}`);
      console.log(`URL: ${p.url}`);
      console.log(`Status: ${p.status}${p.httpCode ? ` (${p.httpCode})` : ''}`);
      if (p.likelyGuessed) {
        console.log(`Warning: ${p.guessReason}`);
      }
      if (p.error) {
        console.log(`Error: ${p.error}`);
      }
    }
  }

  // Write report file
  const reportFile = tripFile.replace('.json', '-url-report.json');
  fs.writeFileSync(reportFile, JSON.stringify(results, null, 2));
  console.log(`\nReport written to: ${reportFile}`);

  return results;
}

// Main
const args = process.argv.slice(2);
if (args.length === 0) {
  console.log('Usage: node validate-urls.js <trip-file.json>');
  console.log('Example: node validate-urls.js ../samples/europe-romantic-7day.json');
  process.exit(1);
}

validateTripUrls(args[0]).catch(err => {
  console.error('Validation failed:', err);
  process.exit(1);
});
