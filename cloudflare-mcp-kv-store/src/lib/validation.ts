/**
 * Security validation utilities for Voygent MCP Server
 */

/**
 * Validate that a trip ID is safe (no path traversal)
 * Only allows alphanumeric, underscore, hyphen, and period characters
 * Rejects: .., /, \, null bytes, and other unsafe characters
 */
export function validateTripId(tripId: string): void {
  if (!tripId || typeof tripId !== 'string') {
    throw new Error('Trip ID is required');
  }

  // Check length limits (1-128 chars)
  if (tripId.length > 128) {
    throw new Error('Invalid trip ID: must be 128 characters or less');
  }

  // Check for path traversal attempts
  if (tripId.includes('..') || tripId.includes('/') || tripId.includes('\\')) {
    throw new Error('Invalid trip ID: path traversal not allowed');
  }

  // Check for null bytes (could be used to bypass checks)
  if (tripId.includes('\0')) {
    throw new Error('Invalid trip ID: null bytes not allowed');
  }

  // Whitelist: only allow safe characters
  // alphanumeric, underscore, hyphen, period (but not starting/ending with period)
  const safePattern = /^[a-zA-Z0-9][a-zA-Z0-9_\-\.]*[a-zA-Z0-9]$|^[a-zA-Z0-9]$/;
  if (!safePattern.test(tripId)) {
    throw new Error('Invalid trip ID: must contain only alphanumeric characters, underscores, hyphens, and periods');
  }

  // Additional check: no consecutive periods (could be used for tricks)
  if (tripId.includes('..')) {
    throw new Error('Invalid trip ID: consecutive periods not allowed');
  }
}

/**
 * Validate that a filename is safe for publishing
 * Only allows alphanumeric, underscore, hyphen, and single period for extension
 */
export function validateFilename(filename: string): void {
  if (!filename || typeof filename !== 'string') {
    throw new Error('Filename is required');
  }

  // Check length limits (1-128 chars)
  if (filename.length > 128) {
    throw new Error('Invalid filename: must be 128 characters or less');
  }

  // Check for path traversal attempts
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    throw new Error('Invalid filename: path traversal not allowed');
  }

  // Check for null bytes
  if (filename.includes('\0')) {
    throw new Error('Invalid filename: null bytes not allowed');
  }

  // Normalize: remove .html extension if present, we'll add it back
  const baseName = filename.replace(/\.html$/i, '');

  // Whitelist: only allow safe characters in base name
  const safePattern = /^[a-zA-Z0-9][a-zA-Z0-9_\-]*[a-zA-Z0-9]$|^[a-zA-Z0-9]$/;
  if (!safePattern.test(baseName)) {
    throw new Error('Invalid filename: must contain only alphanumeric characters, underscores, and hyphens');
  }
}

/**
 * Sanitize a string for use in KV keys
 * Returns a safe, normalized key component
 */
export function sanitizeKeyComponent(input: string): string {
  if (!input || typeof input !== 'string') {
    throw new Error('Key component is required');
  }

  // Replace any non-alphanumeric character with underscore
  // Then collapse multiple underscores into one
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, ''); // Remove leading/trailing underscores
}

/**
 * Validate sections array for read_trip_section
 */
export function validateSections(sections: string[]): void {
  if (!Array.isArray(sections) || sections.length === 0) {
    throw new Error('Sections array is required');
  }

  // Must match the enum in mcp/tools.ts read_trip_section schema
  const allowedSections = [
    'meta', 'travelers', 'dates', 'budget', 'flights', 'lodging', 'itinerary',
    'tiers', 'media', 'bookings', 'featuredLinks', 'cruiseInfo',
    // Additional sections used in trips but not in schema enum
    'tours', 'transportation', 'maps', 'contacts', 'documents', 'notes',
    'payments', 'deposits'
  ];

  for (const section of sections) {
    if (typeof section !== 'string') {
      throw new Error('Section names must be strings');
    }
    if (!allowedSections.includes(section)) {
      throw new Error(`Invalid section: ${section}. Allowed: ${allowedSections.join(', ')}`);
    }
  }
}
