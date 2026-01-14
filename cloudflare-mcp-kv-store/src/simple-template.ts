/**
 * Simple template engine for Cloudflare Workers
 * Supports: {{variable}}, {{nested.path}}, {{#if}}...{{/if}}, {{#each}}...{{/each}}
 * Properly handles nested blocks
 */

// Helper to get nested value from object using dot notation
function getValue(obj: any, path: string): any {
  if (!path || path === 'this') return obj;
  return path.split('.').reduce((acc, part) => acc?.[part], obj);
}

// Helper functions for formatting
function formatCurrency(amount: number | string): string {
  if (amount === undefined || amount === null) return '';
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return String(amount);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(num);
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch {
    return dateStr;
  }
}

function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function pluralize(count: number, singular: string, plural?: string): string {
  const p = plural || singular + 's';
  return `${count} ${count === 1 ? singular : p}`;
}

function isTruthy(value: any): boolean {
  if (value === undefined || value === null || value === false || value === '') return false;
  if (Array.isArray(value) && value.length === 0) return false;
  return true;
}

// Find matching closing tag, accounting for nesting
function findMatchingClose(template: string, openTag: string, closeTag: string, startPos: number): number {
  let depth = 1;
  let pos = startPos;

  while (pos < template.length && depth > 0) {
    const nextOpen = template.indexOf(openTag, pos);
    const nextClose = template.indexOf(closeTag, pos);

    if (nextClose === -1) return -1; // No closing tag found

    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth++;
      pos = nextOpen + openTag.length;
    } else {
      depth--;
      if (depth === 0) return nextClose;
      pos = nextClose + closeTag.length;
    }
  }

  return -1;
}

// Process a single template with given context
function processTemplate(template: string, ctx: any, parentCtx?: any): string {
  let result = '';
  let pos = 0;

  while (pos < template.length) {
    // Find next template tag
    const tagStart = template.indexOf('{{', pos);

    if (tagStart === -1) {
      // No more tags, append rest of template
      result += template.slice(pos);
      break;
    }

    // Append text before tag
    result += template.slice(pos, tagStart);

    // Find end of tag
    const tagEnd = template.indexOf('}}', tagStart);
    if (tagEnd === -1) {
      result += template.slice(tagStart);
      break;
    }

    const tagContent = template.slice(tagStart + 2, tagEnd).trim();
    pos = tagEnd + 2;

    // Handle different tag types
    if (tagContent.startsWith('#if ')) {
      // {{#if condition}}
      const condition = tagContent.slice(4).trim();
      const closeTag = '{{/if}}';
      const elseTag = '{{else}}';

      // Find matching {{/if}}
      const closePos = findMatchingCloseIf(template, pos);
      if (closePos === -1) {
        result += `{{${tagContent}}}`;
        continue;
      }

      const blockContent = template.slice(pos, closePos);
      pos = closePos + closeTag.length;

      // Check for {{else}}
      const elsePos = findElseInBlock(blockContent);

      let conditionValue = getValue(ctx, condition);
      // Also check parent context if not found
      if (conditionValue === undefined && parentCtx) {
        conditionValue = getValue(parentCtx, condition);
      }

      if (isTruthy(conditionValue)) {
        const ifContent = elsePos === -1 ? blockContent : blockContent.slice(0, elsePos);
        result += processTemplate(ifContent, ctx, parentCtx);
      } else if (elsePos !== -1) {
        const elseContent = blockContent.slice(elsePos + elseTag.length);
        result += processTemplate(elseContent, ctx, parentCtx);
      }

    } else if (tagContent.startsWith('#with ')) {
      // {{#with (lookup obj key)}} or {{#with path}}
      const withExpr = tagContent.slice(6).trim();
      const closeTag = '{{/with}}';

      // Find matching {{/with}}
      const closePos = findMatchingCloseWith(template, pos);
      if (closePos === -1) {
        result += `{{${tagContent}}}`;
        continue;
      }

      const blockContent = template.slice(pos, closePos);
      pos = closePos + closeTag.length;

      // Handle (lookup obj key) expression
      const lookupMatch = withExpr.match(/^\(lookup\s+([^\s]+)\s+([^\)]+)\)$/);
      let withValue;
      if (lookupMatch) {
        const objPath = lookupMatch[1];
        const keyPath = lookupMatch[2].trim();
        let obj = getValue(ctx, objPath);
        if (obj === undefined && parentCtx) obj = getValue(parentCtx, objPath);
        let key = getValue(ctx, keyPath);
        if (key === undefined && parentCtx) key = getValue(parentCtx, keyPath);
        withValue = obj?.[key];
      } else {
        withValue = getValue(ctx, withExpr);
        if (withValue === undefined && parentCtx) {
          withValue = getValue(parentCtx, withExpr);
        }
      }

      if (isTruthy(withValue)) {
        result += processTemplate(blockContent, withValue, ctx);
      }

    } else if (tagContent.startsWith('#unless ')) {
      // {{#unless condition}} - inverse of #if
      const condition = tagContent.slice(8).trim();
      const closeTag = '{{/unless}}';

      const closePos = findMatchingCloseUnless(template, pos);
      if (closePos === -1) {
        result += `{{${tagContent}}}`;
        continue;
      }

      const blockContent = template.slice(pos, closePos);
      pos = closePos + closeTag.length;

      let conditionValue = getValue(ctx, condition);
      if (conditionValue === undefined && parentCtx) {
        conditionValue = getValue(parentCtx, condition);
      }

      if (!isTruthy(conditionValue)) {
        result += processTemplate(blockContent, ctx, parentCtx);
      }

    } else if (tagContent.startsWith('#each ')) {
      // {{#each array}}
      const arrayPath = tagContent.slice(6).trim();
      const closeTag = '{{/each}}';

      // Find matching {{/each}}
      const closePos = findMatchingCloseEach(template, pos);
      if (closePos === -1) {
        result += `{{${tagContent}}}`;
        continue;
      }

      const blockContent = template.slice(pos, closePos);
      pos = closePos + closeTag.length;

      let array = getValue(ctx, arrayPath);
      // Also check parent context
      if (array === undefined && parentCtx) {
        array = getValue(parentCtx, arrayPath);
      }

      if (Array.isArray(array)) {
        array.forEach((item, index) => {
          let itemTemplate = blockContent;
          // Replace {{@index}} and {{@key}}
          itemTemplate = itemTemplate.replace(/\{\{@index\}\}/g, String(index));
          itemTemplate = itemTemplate.replace(/\{\{@key\}\}/g, String(index));

          // For simple values, {{this}} refers to the item
          if (typeof item !== 'object' || item === null) {
            itemTemplate = itemTemplate.replace(/\{\{this\}\}/g, String(item));
            result += processTemplate(itemTemplate, ctx, parentCtx);
          } else {
            // For objects, process with item as context, parent as fallback
            result += processTemplate(itemTemplate, item, ctx);
          }
        });
      } else if (typeof array === 'object' && array !== null) {
        // Handle object iteration
        Object.entries(array).forEach(([key, value], index) => {
          let itemTemplate = blockContent;
          itemTemplate = itemTemplate.replace(/\{\{@index\}\}/g, String(index));
          itemTemplate = itemTemplate.replace(/\{\{@key\}\}/g, key);

          if (typeof value !== 'object' || value === null) {
            itemTemplate = itemTemplate.replace(/\{\{this\}\}/g, String(value));
            result += processTemplate(itemTemplate, ctx, parentCtx);
          } else {
            result += processTemplate(itemTemplate, value as any, ctx);
          }
        });
      }

    } else if (tagContent.startsWith('/')) {
      // Closing tag without matching open - skip
      result += `{{${tagContent}}}`;

    } else if (tagContent.startsWith('else')) {
      // Else without if - skip
      result += `{{${tagContent}}}`;

    } else {
      // Variable or helper
      result += processVariable(tagContent, ctx, parentCtx);
    }
  }

  return result;
}

// Convenience wrappers for each block type
function findMatchingCloseIf(template: string, startPos: number): number {
  return findMatchingClose(template, '{{#if ', '{{/if}}', startPos);
}

function findMatchingCloseEach(template: string, startPos: number): number {
  return findMatchingClose(template, '{{#each ', '{{/each}}', startPos);
}

function findMatchingCloseWith(template: string, startPos: number): number {
  return findMatchingClose(template, '{{#with ', '{{/with}}', startPos);
}

function findMatchingCloseUnless(template: string, startPos: number): number {
  return findMatchingClose(template, '{{#unless ', '{{/unless}}', startPos);
}

// Find {{else}} at the current nesting level only
function findElseInBlock(block: string): number {
  let depth = 0;
  let pos = 0;

  while (pos < block.length) {
    const nextIf = block.indexOf('{{#if ', pos);
    const nextEach = block.indexOf('{{#each ', pos);
    const nextEndIf = block.indexOf('{{/if}}', pos);
    const nextEndEach = block.indexOf('{{/each}}', pos);
    const nextElse = block.indexOf('{{else}}', pos);

    // Find the earliest tag
    const positions = [
      { type: 'if', pos: nextIf },
      { type: 'each', pos: nextEach },
      { type: 'endif', pos: nextEndIf },
      { type: 'endeach', pos: nextEndEach },
      { type: 'else', pos: nextElse }
    ].filter(p => p.pos !== -1).sort((a, b) => a.pos - b.pos);

    if (positions.length === 0) break;

    const next = positions[0];

    if (next.type === 'if' || next.type === 'each') {
      depth++;
      pos = next.pos + 6;
    } else if (next.type === 'endif' || next.type === 'endeach') {
      depth--;
      pos = next.pos + 7;
    } else if (next.type === 'else' && depth === 0) {
      return next.pos;
    } else {
      pos = next.pos + 6;
    }
  }

  return -1;
}

// Process a variable or helper tag
function processVariable(tagContent: string, ctx: any, parentCtx?: any): string {
  // {{timestamp}} - current render time
  if (tagContent === 'timestamp') {
    return new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  }

  // {{encodeUri path}} - URL encode a value
  if (tagContent.startsWith('encodeUri ')) {
    const path = tagContent.slice(10).trim();
    let value = getValue(ctx, path);
    if (value === undefined && parentCtx) value = getValue(parentCtx, path);
    return encodeURIComponent(String(value || ''));
  }

  // {{formatCurrency path}}
  if (tagContent.startsWith('formatCurrency ')) {
    const path = tagContent.slice(15).trim();
    let value = getValue(ctx, path);
    if (value === undefined && parentCtx) value = getValue(parentCtx, path);
    return formatCurrency(value);
  }

  // {{formatDate path}}
  if (tagContent.startsWith('formatDate ')) {
    const path = tagContent.slice(11).trim();
    let value = getValue(ctx, path);
    if (value === undefined && parentCtx) value = getValue(parentCtx, path);
    return formatDate(value);
  }

  // {{capitalize path}}
  if (tagContent.startsWith('capitalize ')) {
    const path = tagContent.slice(11).trim();
    let value = getValue(ctx, path);
    if (value === undefined && parentCtx) value = getValue(parentCtx, path);
    return capitalize(String(value || ''));
  }

  // {{pluralize count "singular" "plural"}}
  const pluralMatch = tagContent.match(/^pluralize\s+([^\s]+)\s+"([^"]+)"\s+"([^"]+)"$/);
  if (pluralMatch) {
    let count = getValue(ctx, pluralMatch[1]);
    if (count === undefined && parentCtx) count = getValue(parentCtx, pluralMatch[1]);
    return pluralize(Number(count) || 0, pluralMatch[2], pluralMatch[3]);
  }

  // {{default path "defaultValue"}}
  const defaultMatch = tagContent.match(/^default\s+([^\s]+)\s+"([^"]+)"$/);
  if (defaultMatch) {
    let value = getValue(ctx, defaultMatch[1]);
    if (value === undefined && parentCtx) value = getValue(parentCtx, defaultMatch[1]);
    return (value !== undefined && value !== null && value !== '') ? String(value) : defaultMatch[2];
  }

  // Simple variable {{path}}
  let value = getValue(ctx, tagContent);
  if (value === undefined && parentCtx) {
    value = getValue(parentCtx, tagContent);
  }

  if (value === undefined || value === null) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

// Main export
export function renderTemplate(template: string, data: any): string {
  return processTemplate(template, data);
}
