/**
 * Safe clipboard utility.
 *
 * `navigator.clipboard` is only available in secure contexts (HTTPS or localhost).
 * This helper falls back to the legacy `document.execCommand("copy")` in HTTP
 * environments so the app never throws a TypeError at runtime.
 */
export async function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  // Fallback for non-secure contexts (HTTP / old browsers)
  const el = document.createElement("textarea");
  el.value = text;
  el.style.position = "fixed";
  el.style.top = "0";
  el.style.left = "0";
  el.style.opacity = "0";
  document.body.appendChild(el);
  el.focus();
  el.select();
  document.execCommand("copy");
  document.body.removeChild(el);
}
