import Handlebars from 'handlebars';

/**
 * Register custom Handlebars helpers for trip template rendering
 */
export function registerHelpers(): typeof Handlebars {
  // Format date: "2026-10-15" → "October 15, 2026"
  Handlebars.registerHelper('formatDate', (dateStr: string, format?: string) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;

      const options: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      };

      if (format === 'short') {
        options.month = 'short';
      } else if (format === 'weekday') {
        options.weekday = 'long';
      }

      return date.toLocaleDateString('en-US', options);
    } catch {
      return dateStr;
    }
  });

  // Format currency: 2500 → "$2,500"
  Handlebars.registerHelper('formatCurrency', (amount: number | string, currency?: string) => {
    if (amount === undefined || amount === null) return '';
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(num)) return amount;

    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(num);
  });

  // Pluralize: (4, "traveler") → "4 travelers"
  Handlebars.registerHelper('pluralize', (count: number, singular: string, plural?: string) => {
    const p = plural || singular + 's';
    return `${count} ${count === 1 ? singular : p}`;
  });

  // Conditional equality: {{#ifEquals status "confirmed"}}...{{/ifEquals}}
  Handlebars.registerHelper('ifEquals', function(this: any, a: any, b: any, options: Handlebars.HelperOptions) {
    return a === b ? options.fn(this) : options.inverse(this);
  });

  // Conditional not equals
  Handlebars.registerHelper('ifNotEquals', function(this: any, a: any, b: any, options: Handlebars.HelperOptions) {
    return a !== b ? options.fn(this) : options.inverse(this);
  });

  // Day number from index: {{dayNumber @index}} → "Day 1"
  Handlebars.registerHelper('dayNumber', (index: number) => {
    return `Day ${index + 1}`;
  });

  // JSON stringify for debugging
  Handlebars.registerHelper('json', (context: any) => {
    return JSON.stringify(context, null, 2);
  });

  // Safe URL encoding
  Handlebars.registerHelper('encodeURI', (str: string) => {
    return encodeURIComponent(str || '');
  });

  // Default value helper
  Handlebars.registerHelper('default', (value: any, defaultValue: any) => {
    return value !== undefined && value !== null && value !== '' ? value : defaultValue;
  });

  // Array length check
  Handlebars.registerHelper('hasItems', function(this: any, arr: any[], options: Handlebars.HelperOptions) {
    return arr && arr.length > 0 ? options.fn(this) : options.inverse(this);
  });

  // Greater than comparison
  Handlebars.registerHelper('ifGt', function(this: any, a: number, b: number, options: Handlebars.HelperOptions) {
    return a > b ? options.fn(this) : options.inverse(this);
  });

  // Math operations
  Handlebars.registerHelper('add', (a: number, b: number) => a + b);
  Handlebars.registerHelper('subtract', (a: number, b: number) => a - b);
  Handlebars.registerHelper('multiply', (a: number, b: number) => a * b);

  // String helpers
  Handlebars.registerHelper('uppercase', (str: string) => str?.toUpperCase() || '');
  Handlebars.registerHelper('lowercase', (str: string) => str?.toLowerCase() || '');
  Handlebars.registerHelper('capitalize', (str: string) => {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  });

  // Current year (for copyright)
  Handlebars.registerHelper('currentYear', () => new Date().getFullYear());

  return Handlebars;
}
