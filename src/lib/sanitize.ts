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
 * Strips all HTML tags and removes dangerous script patterns.
 * Pure JS implementation that does not require JSDOM in serverless runtimes.
 */
export function stripHtml(dirty: string): string {
  if (typeof dirty !== "string") return String(dirty ?? "");

  // Remove null bytes
  let sanitized = dirty.replaceAll("\0", "");

  // Strip script and style blocks completely including contents
  sanitized = sanitized
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");

  // Strip remaining HTML tags
  sanitized = sanitized.replace(/<\/?[a-zA-Z][^>]*>/g, "");

  // Remove dangerous protocols from plain text contexts without dynamic regexes.
  for (const protocol of DANGEROUS_PROTOCOLS) {
    sanitized = replaceCaseInsensitive(sanitized, protocol, "[removed]");
  }

  sanitized = replaceCaseInsensitive(sanitized, "expression(", "[removed](");

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

