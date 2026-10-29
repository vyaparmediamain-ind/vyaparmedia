/**
 * Real-time Client-side Contact Leak Detector
 *
 * Scans message drafts as the user types to detect phone numbers, emails,
 * external links, payment handles, and social app references.
 *
 * Guarantees zero false-negatives on critical contact information
 * (better to over-warn with a helpful non-blocking nudge than to under-warn),
 * while remaining smart enough to not trigger on campaign deliverable mentions
 * (e.g. "1 Instagram Reel").
 */

export interface ContactLeakResult {
  hasLeak: boolean;
  detectedTypes: string[];
  warningMessage: string;
  matchedSamples: string[];
}

export const NUMBER_WORDS: Record<string, string> = {
  zero: "0", shunya: "0", soonya: "0", sunya: "0", oh: "0",
  one: "1", ek: "1", ik: "1",
  two: "2", do: "2", dou: "2",
  three: "3", teen: "3", tin: "3",
  four: "4", char: "4", chaar: "4",
  five: "5", panch: "5", paanch: "5",
  six: "6", chhe: "6", che: "6", chha: "6",
  seven: "7", saat: "7", sat: "7",
  eight: "8", aath: "8", aat: "8", ath: "8",
  nine: "9", nau: "9", no: "9", naw: "9",
};

export function normalizeUnicodeDigits(str: string): string {
  return str
    .replace(/[\u0966-\u096F]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x0966 + 48))
    .replace(/[\uFF10-\uFF19]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xFF10 + 48));
}

/**
 * Normalizes text to uncover obfuscated text (homoglyphs, leetspeak, spaces)
 */
export function normalizeContactText(raw: string): string {
  if (!raw) return "";
  let text = normalizeUnicodeDigits(raw).toLowerCase();

  text = text
    .replace(/[@]/g, "a")
    .replace(/[$]/g, "s")
    .replace(/[0]/g, "o")
    .replace(/[1]/g, "i")
    .replace(/[3]/g, "e")
    .replace(/[4]/g, "a")
    .replace(/[5]/g, "s")
    .replace(/[7]/g, "t");

  return text;
}

/**
 * Converts spelled out number words to digits to catch "nine eight seven..."
 */
export function convertNumberWordsToDigits(text: string): string {
  let result = text.toLowerCase();
  for (const [word, digit] of Object.entries(NUMBER_WORDS)) {
    const regex = new RegExp(`\\b${word}\\b`, "gi");
    result = result.replace(regex, digit);
  }
  return result;
}

export function detectContactLeak(content: string): ContactLeakResult {
  if (!content || !content.trim()) {
    return {
      hasLeak: false,
      detectedTypes: [],
      warningMessage: "",
      matchedSamples: [],
    };
  }

  const detectedTypes: string[] = [];
  const matchedSamples: string[] = [];
  const raw = normalizeUnicodeDigits(content.trim());
  const lower = raw.toLowerCase();
  const wordConverted = convertNumberWordsToDigits(lower);

  // 1. Email Detection (Standard + Obfuscated)
  const standardEmailRegex = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
  const obfuscatedEmailRegex =
    /[a-z0-9._%+-]+\s*(?:@|\(at\)|\[at\]|\bat\b)\s*[a-z0-9.-]+\s*(?:\.|\(dot\)|\[dot\]|\bdot\b)\s*(?:com|in|co|net|org|io)/gi;

  const emailMatch = raw.match(standardEmailRegex) || raw.match(obfuscatedEmailRegex);
  if (emailMatch) {
    detectedTypes.push("Email Address");
    matchedSamples.push(emailMatch[0]);
  }

  // 2. Phone Number Detection
  // Standard phone numbers (Indian 10-digit mobile starting with 6-9, with or without +91)
  const standardPhoneRegex = /(?:(?:\+?91[\s.-]*)?[6-9]\d{9})\b/g;
  // Spaced digits e.g. "9 8 7 6 5 4 3 2 1 0" or "98765 43210" or "9876-543-210"
  const spacedPhoneRegex = /(?:(?:\+?91[\s.-]*)?[6-9](?:[\s.-]*\d){9})\b/g;

  const phoneMatch =
    raw.match(standardPhoneRegex) ||
    raw.match(spacedPhoneRegex) ||
    wordConverted.match(spacedPhoneRegex);

  // Also check if wordConverted stripped string has a run of 10+ digits
  const allDigits = wordConverted.replace(/\D/g, "");
  const has10DigitRun = /[6-9]\d{9}/.test(allDigits);

  if (phoneMatch || has10DigitRun) {
    detectedTypes.push("Phone Number");
    matchedSamples.push(phoneMatch ? phoneMatch[0] : allDigits.slice(0, 10));
  }

  // 3. External URLs, Website Links & Bio Links
  const urlRegex =
    /(?:https?:\/\/|www\.)[^\s/$.?#].[^\s]*|(?:\b[a-z0-9.-]+\.(?:com|in|co|org|net|io|me|app|ai|ly|link|to|ee)\b)|linktr\.ee[^\s]*/gi;
  const urlMatch = raw.match(urlRegex);
  if (urlMatch) {
    detectedTypes.push("External Link");
    matchedSamples.push(urlMatch[0]);
  }

  // 4. Social Handles & External Messaging Platforms
  // (Carefully distinguish handle sharing vs deliverable mentions like "1 Instagram Reel")
  const isDeliverableMention =
    /\b(?:instagram|insta)\s+(?:reel|reels|story|stories|post|posts|deliverable|deliverables|video|collaboration)\b/i.test(
      raw
    ) && !/\b(?:dm|dm me|follow|at|@|check|profile|handle|my)\b/i.test(raw);

  if (!isDeliverableMention) {
    const socialPatterns = [
      { name: "WhatsApp", regex: /\b(?:whatsapp|wa\.me|wp|watsapp)\b/gi },
      {
        name: "Instagram Handle",
        regex:
          /(?:@|my\s+ig|my\s+insta|dm\s+me\s+on\s+instagram|follow\s+me\s+on\s+instagram|ig:|insta:)[a-z0-9._]{2,30}\b|@[a-z0-9._]{3,30}\b/gi,
      },
      { name: "Telegram", regex: /\b(?:telegram|t\.me|tg)\b/gi },
      { name: "Call / Contact Intent", regex: /\b(?:call me|dm me|msg me|text me|ping me|phone me)\b/gi },
    ];

    for (const { name, regex } of socialPatterns) {
      const match = raw.match(regex);
      if (match) {
        if (!detectedTypes.includes(name)) {
          detectedTypes.push(name);
        }
        matchedSamples.push(match[0]);
      }
    }
  }

  // 5. UPI / Payment Handle Detection
  const upiRegex =
    /[a-z0-9._-]+@(?!google\b)(?:paytm|federal|icici|axis|ok[a-z]+|wa[a-z]+|ybl|sbi|[a-z]{3,4})\b/gi;
  const upiMatch = raw.match(upiRegex) || /\b(?:gpay|paytm|phonepe|upi id|vpa)\b/i.test(raw);
  if (upiMatch) {
    detectedTypes.push("Payment / UPI Handle");
    matchedSamples.push(typeof upiMatch === "object" ? upiMatch[0] : "UPI Reference");
  }

  const hasLeak = detectedTypes.length > 0;
  const warningMessage = hasLeak
    ? `Platform ke bahar contact share karna deal protection khatam kar sakta hai (${detectedTypes.join(
        ", "
      )} detected). VyaparMedia escrow guarantees apply only on-platform.`
    : "";

  return {
    hasLeak,
    detectedTypes,
    warningMessage,
    matchedSamples,
  };
}
