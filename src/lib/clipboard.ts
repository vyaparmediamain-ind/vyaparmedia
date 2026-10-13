/**
 * Safe clipboard utility.
 *
 * `navigator.clipboard` is only available in secure contexts (HTTPS or localhost).
 * This helper falls back to the legacy `document.execCommand("copy")` in HTTP
 * environments so the app never throws a TypeError at runtime.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof window === "undefined") return false;

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to execCommand if permission denied, iframe sandbox, or not focused
    }
  }

  // Fallback for non-secure contexts (HTTP / old browsers / iframes)
  try {
    const el = document.createElement("textarea");
    el.value = text;
    el.style.position = "fixed";
    el.style.top = "0";
    el.style.left = "0";
    el.style.opacity = "0";
    el.setAttribute("readonly", "");
    document.body.appendChild(el);
    el.focus();
    el.select();
    const success = document.execCommand("copy");
    document.body.removeChild(el);
    return success;
  } catch {
    return false;
  }
}
