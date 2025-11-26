/**
 * Route matching utility
 * Supports:
 * 1. Exact match / Includes (Legacy)
 * 2. Dynamic params: /api/users/:id
 * 3. Wildcards: /api/files/*
 */

interface MatchResult {
  match: boolean;
  params: Record<string, string>;
}

interface ParsedRoute {
  regex: RegExp;
  keys: string[];
}

// Cache parsed patterns to avoid re-compiling Regex
const patternCache = new Map<string, ParsedRoute | null>();

function parseRoute(ruleUrl: string): ParsedRoute | null {
  if (patternCache.has(ruleUrl)) {
    return patternCache.get(ruleUrl)!;
  }

  // Only treat as pattern if it has : or *
  if (!ruleUrl.includes(':') && !ruleUrl.includes('*')) {
    patternCache.set(ruleUrl, null);
    return null;
  }

  const keys: string[] = [];
  // Escape special regex chars except : and *
  // We want to match literal parts of the string safely
  // But :param needs to become capture group
  // * needs to become (.*)

  // Strategy: 
  // 1. Escape common regex chars: . + ? ^ $ { } ( ) [ ] | \
  // 2. Replace :param with capture
  // 3. Replace * with (.*)

  // Note: We can't simply escape everything first because we lose : and * location if we are not careful.
  // Let's split by slash to handle segments.

  // Simple approach:
  // Escape everything, then unescape : and * logic? No, that's messy.
  // Manually build regex string.

  let regexStr = ruleUrl
    .replace(/[.+?^${}()|[\\]/g, '\$&') // Escape special chars
    .replace(/:([a-zA-Z0-9_]+)/g, (_, key) => {
      keys.push(key);
      return '([^/]+)'; // Match segment
    })
    .replace(/\*/g, '(.*)'); // Match wildcard

  // Anchor to end of string to ensure we match the full path segment requested
  // e.g. rule "/users/:id" should match ".../users/123"
  const regex = new RegExp(regexStr + '$');
  
  const result = { regex, keys };
  patternCache.set(ruleUrl, result);
  return result;
}

export function matchRoute(ruleUrl: string, requestUrl: string): MatchResult {
  // 1. Clean URL (remove query string for matching path)
  // If requestUrl is full URL, we still match against it directly because existing logic allows it.
  // But for pattern matching, we usually care about the path.
  // However, to support "includes", we can't be too strict stripping things unless we know what we are doing.
  
  // Let's parse the requestUrl to remove query params for pattern matching?
  // Rule: /users/:id
  // Request: http://localhost/users/123?foo=bar
  // We want to match /users/123.
  
  let cleanUrl = requestUrl;
  try {
    if (requestUrl.includes('?')) {
      cleanUrl = requestUrl.split('?')[0];
    }
  } catch (e) {
    // ignore
  }

  // 2. Try Pattern Match first (Higher priority if rule is a pattern)
  const pattern = parseRoute(ruleUrl);
  
  if (pattern) {
    const match = cleanUrl.match(pattern.regex);
    if (match) {
      const params: Record<string, string> = {};
      pattern.keys.forEach((key, index) => {
        params[key] = match[index + 1];
      });
      return { match: true, params };
    }
    // If rule looks like a pattern but failed to match regex, we probably shouldn't fallback to 'includes'?
    // Example: Rule /users/:id
    // Request: /users/
    // Regex /users/([^/]+)$ requires a segment.
    // 'includes' might match if we are not careful.
    // Let's assume if it's a pattern rule, it MUST match via pattern.
    return { match: false, params: {} };
  }

  // 3. Fallback to Legacy Behavior (Exact / EndsWith / Includes)
  // We use original requestUrl here to preserve existing behavior (which might rely on query params?)
  // Though usually matching rules against query params in URL string is flaky.
  // Existing logic:
  // const isExactMatch = url === r.url || url.endsWith(r.url);
  // const isIncludeMatch = url.includes(r.url);
  
  const isExactMatch = requestUrl === ruleUrl || requestUrl.endsWith(ruleUrl);
  const isIncludeMatch = requestUrl.includes(ruleUrl);

  return { match: isExactMatch || isIncludeMatch, params: {} };
}
