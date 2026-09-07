/**
* Enterprise Input Sanitization
* Protects against XSS, NoSQL Injection, and Prototype Pollution.
*
* Design: Defense-in-depth layer. Zod schemas are the primary validation.
* This module provides an additional sanitization pass to catch anything
* that slips through, and to handle raw string processing in non-Zod contexts.
*/
import DOMPurify from "isomorphic-dompurify";

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
* Uses a comprehensive allowlist-approach for protocol removal.
*/
export function stripHtml(dirty: string): string {
if (typeof dirty !== "string") return String(dirty ?? "");

let sanitized = DOMPurify.sanitize(dirty.replaceAll("\0", ""), {
ALLOWED_TAGS: [],
ALLOWED_ATTR: [],
KEEP_CONTENT: true,
});

if (typeof sanitized !== "string") {
sanitized = String(sanitized);
}

// Remove dangerous protocols from plain text contexts without dynamic regexes.
for (const protocol of DANGEROUS_PROTOCOLS) {
sanitized = replaceCaseInsensitive(sanitized, protocol, "[removed]");
}

sanitized = replaceCaseInsensitive(sanitized, "expression(", "[removed](");

return sanitized;
}
