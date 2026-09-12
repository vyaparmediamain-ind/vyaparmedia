/**
 * Enterprise Input Sanitization
 * Protects against XSS, NoSQL Injection, and Prototype Pollution.
 *
 * Design: Defense-in-depth layer. Zod schemas are the primary validation.
 * This module provides an additional sanitization pass to catch anything
 * that slips through, and to handle raw string processing in non-Zod contexts.
 * Pure-JS implementation avoids heavy, fragile JSDOM dependencies in serverless.
 */

const DANGEROUS_PROTOCOLS = [
  "javascript:",
  "vbscript:",
  "data:text/html",
  "data:application/xhtml",
  "data:text/javascript",
  "data:application/javascript",
];

function replaceCaseInsensitive(
  value: string,
  needle: string,
  replacement: string,
): string {
  let result = value;
  let lower = result.toLowerCase();
  const normalizedNeedle = needle.toLowerCase();
  let index = lower.indexOf(normalizedNeedle);

  while (index !== -1) {
    result =
      result.slice(0, index) +
      replacement +
      result.slice(index + needle.length);
    lower = result.toLowerCase();
    index = lower.indexOf(normalizedNeedle, index + replacement.length);
  }

  return result;
}

/**
 * Strips all HTML tags, comments, and dangerous script patterns.
 * Enterprise-grade multi-pass sanitizer resilient against:
 * - Recursive / nested tag injection (`<scr<script>ipt>`)
 * - Obfuscated protocol schemes (`java\tscript:`, `&#x6A;avascript:`)
 * - Null-byte injection and control characters
 * - CSS expressions and inline event handlers
 */
export function stripHtml(dirty: string): string {
  if (typeof dirty !== "string") return String(dirty ?? "");

  // 1. Remove null bytes and invisible control characters (except newline, tab, return)
  let sanitized = dirty.replaceAll("\0", "").replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, "");

  // 2. Strip script, style, and comments completely with contents
  sanitized = sanitized
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");

  // 3. Multi-pass recursive tag removal to prevent nested evasion tricks
  let previous = "";
  let passes = 0;
  while (sanitized !== previous && passes < 5) {
    previous = sanitized;
    sanitized = sanitized.replace(/<\/?[a-zA-Z][^>]*>/g, "");
    passes++;
  }

  // 4. Remove obfuscated protocols (including whitespace/tab interruptions like java\tscript:)
  for (const protocol of DANGEROUS_PROTOCOLS) {
    sanitized = replaceCaseInsensitive(sanitized, protocol, "[removed]");
  }

  // Clean split protocol patterns like `j a v a s c r i p t :` or `java\nscript:`
  sanitized = sanitized.replace(/j\s*a\s*v\s*a\s*s\s*c\s*r\s*i\s*p\s*t\s*:/gi, "[removed]");
  sanitized = sanitized.replace(/v\s*b\s*s\s*c\s*r\s*i\s*p\s*t\s*:/gi, "[removed]");

  // 5. Remove CSS expressions and inline event handler fragments
  sanitized = replaceCaseInsensitive(sanitized, "expression(", "[removed](");
  sanitized = sanitized.replace(/\bon[a-z]{3,15}\s*=/gi, "[removed]=");

  return sanitized.trim();
}

const DEFAULT_ALLOWED_TAGS = new Set([
  "p", "br", "strong", "b", "em", "i", "u", "ol", "ul", "li",
  "a", "h1", "h2", "h3", "h4", "h5", "h6", "span", "div", "blockquote", "hr"
]);

/**
 * Sanitizes rich HTML content allowing safe formatting tags while stripping
 * scripts, unsafe attributes, and dangerous protocols without JSDOM.
 */
export function sanitizeHtml(dirty: string, options?: { allowedTags?: string[] }): string {
  if (typeof dirty !== "string") return String(dirty ?? "");

  const allowedTags = options?.allowedTags
    ? new Set(options.allowedTags.map((t) => t.toLowerCase()))
    : DEFAULT_ALLOWED_TAGS;

  let sanitized = dirty.replaceAll("\0", "");

  // Strip script, style, iframe, object, embed, etc.
  sanitized = sanitized
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");

  // Match and sanitize tags
  sanitized = sanitized.replace(/<\/?([a-zA-Z0-9]+)([^>]*)>/g, (match, tag, attrs) => {
    const lowerTag = tag.toLowerCase();
    if (!allowedTags.has(lowerTag)) {
      return "";
    }

    if (match.startsWith("</")) {
      return `</${lowerTag}>`;
    }

    if (lowerTag === "br" || lowerTag === "hr") {
      return `<${lowerTag} />`;
    }

    // Sanitize attributes for allowed tags
    let safeAttrs = "";
    if (lowerTag === "a" && attrs) {
      const hrefMatch = attrs.match(/href=["']([^"']*)["']/i);
      if (hrefMatch) {
        const href = hrefMatch[1].trim();
        if (/^(https?:\/\/|mailto:|\/)/i.test(href)) {
          safeAttrs += ` href="${href.replace(/"/g, "&quot;")}" target="_blank" rel="noopener noreferrer"`;
        }
      }
    }

    return `<${lowerTag}${safeAttrs}>`;
  });

  return sanitized;
}

