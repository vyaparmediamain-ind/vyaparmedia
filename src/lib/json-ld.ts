/**
 * Safely serializes data to a JSON-LD string by escaping characters that could allow
 * script breakout (e.g. </script> converted to \u003c/script\u003e).
 */
export function safeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
