import nlp from "compromise";

const CONTACT_REGEX = {
  email: /\b[a-z0-9._%+-]+@[a-z0-9-]+\.[a-z]{2,}\b/gi,
  emailObfuscated:
    /\b[a-z0-9._-]+(?:\s*(?:@|\(at\))\s*|\s+\bat\b\s+)[a-z0-9._-]+\s*(?:\.|\bdot\b)\s*[a-z]{2,}\b/gi,
  phone: /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
url: /(?:https?:\/\/\S+)|(?:www\.\S+)|(?:\b[a-z0-9.-]+\.(?:com|net|org|edu|gov|mil|biz|info|io)\b)/gi,
socialHandle:
/@(?:gmail\.com|whatsapp|instagram|telegram|t\.me|linktr\.ee)\b|whatsapp|instagram|telegram|t\.me|linktr\.ee|insta:|ig:|wp:|vpa:|upi:/gi,
numberWords:
/(?:zero|one|two|three|four|five|six|seven|eight|nine)[\s\p{P}]*(?:zero|one|two|three|four|five|six|seven|eight|nine)/giu,
upi: /\b[a-z0-9._-]+@(?!google\b)(?:paytm|federal|icici|barodampay|postbank|ok[a-z]+|wa[a-z]+|[a-z]{3,4})\b/gi,
};

function normalizeHomoglyphs(str: string): string {
  const homoglyphsMap: Record<string, string> = {
    // lowercase cyrillic/greek
    "\u0430": "a", "\u0435": "e", "\u043e": "o", "\u0440": "p", "\u0441": "c", "\u0443": "y", "\u0445": "x", "\u0456": "i", "\u0455": "s", "\u03b1": "a",
    // uppercase cyrillic/greek
    "\u0410": "A", "\u0412": "B", "\u0415": "E", "\u041a": "K", "\u041c": "M", "\u041d": "H", "\u041e": "O", "\u0420": "P", "\u0421": "C", "\u0422": "T", "\u0425": "X", "\u0406": "I",
    // other common lookalikes/accents
    "\u00e0": "a", "\u00e1": "a", "\u00e2": "a", "\u00e3": "a", "\u00e4": "a", "\u00e5": "a", "\u00e6": "ae", "\u00e7": "c", "\u00e8": "e", "\u00e9": "e", "\u00ea": "e", "\u00eb": "e", "\u00ec": "i",
    "\u00ed": "i", "\u00ee": "i", "\u00ef": "i", "\u00f1": "n", "\u00f2": "o", "\u00f3": "o", "\u00f4": "o", "\u00f5": "o", "\u00f6": "o", "\u00f9": "u", "\u00fa": "u", "\u00fb": "u", "\u00fc": "u",
    "\u00fd": "y", "\u00ff": "y",
  };
  return str.split("").map((char) => homoglyphsMap[char] || char).join("");
}

function cleanAndNormalizeText(str: string): string {
let clean = str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
clean = clean.replace(/[\u200B-\u200D\uFEFF\u0000-\u001F\u007F-\u009F]/g, "");
clean = normalizeHomoglyphs(clean);
clean = clean.toLowerCase();
clean = clean
.replaceAll("@", "a")
.replaceAll("$", "s")
.replace(/[0o]/g, "o")
.replace(/[1i]/g, "i")
.replace(/[3e]/g, "e")
.replace(/[4a]/g, "a")
.replace(/[5s]/g, "s")
.replace(/[7t]/g, "t");

// Keep only alphanumeric characters to strip spaces, emojis, punctuation, etc.
clean = clean.replace(/[^a-z0-9]/g, "");
return clean;
}

function testRegex(regex: RegExp, text: string): boolean {
regex.lastIndex = 0;
return regex.exec(text) !== null;
}

function checkBasicContacts(content: string, findings: string[], options?: { allowUrls?: boolean }) {
if (
testRegex(CONTACT_REGEX.email, content) ||
testRegex(CONTACT_REGEX.emailObfuscated, content) ||
content.toLowerCase().includes(" at gmail dot") ||
content.toLowerCase().includes(" at yahoo dot")
) {
findings.push("email");
}

if (testRegex(CONTACT_REGEX.phone, content)) {
findings.push("phone");
}

if (!options?.allowUrls && testRegex(CONTACT_REGEX.url, content)) {
findings.push("url");
}
}

function checkSocialAndUpi(content: string, normalizedContent: string, findings: string[]) {
if (
testRegex(CONTACT_REGEX.socialHandle, content) ||
["whatsapp", "instagram", "telegram", "linktree", "gmailcom", "insta", "ig", "wp"].some((kw) =>
normalizedContent.includes(kw),
)
) {
findings.push("social");
}

if (
testRegex(CONTACT_REGEX.upi, content) ||
normalizedContent.includes("upiid") ||
normalizedContent.includes("vpa") ||
normalizedContent.includes("paytmme")
) {
findings.push("upi");
}
}

function checkNumberWords(content: string, findings: string[]): number {
let wordCount = 0;
const words = content.toLowerCase().split(/[\s,.-]+/);
const numberWordsSet = new Set([
"zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"
]);
for (const w of words) {
if (numberWordsSet.has(w)) wordCount++;
}
if (wordCount >= 5 || testRegex(CONTACT_REGEX.numberWords, content)) {
findings.push("obfuscated_phone");
}
return wordCount;
}

function checkNlpContact(content: string, findings: string[], wordCount: number, phonePatternMatch: RegExpMatchArray | null) {
const doc = nlp(content);

const hasContactPhrase = doc.match(
"(my|our) (number|phone|whatsapp|telegram|insta|instagram|skype|tg|li|linkedin|mail|email|id) is",
).found;
const hasContactIntent = doc.match(
"(call|text|message|ping|mail|email|reach|dm|pm|whatsapp|contact|connect|talk|speak) (me|us) (on|at|in|via)?",
).found;
const hasPhoneKeywords = doc.match(
"(number|mobile|phone|whatsapp|telegram|insta|instagram|skype|tg|li|linkedin)",
).found;

if (hasContactPhrase || (hasContactIntent && hasPhoneKeywords)) {
if (!findings.includes("nlp_contact_intent")) {
findings.push("nlp_contact_intent");
}
}

const extractedNumbers = doc.numbers().out("array") as string[];
let totalDigitsFromWords = 0;

for (const numStr of extractedNumbers) {
const digitsOnly = String(numStr).replace(/\D/g, "");
totalDigitsFromWords += digitsOnly.length;
}

if (totalDigitsFromWords >= 10 && wordCount < 5) {
if (!findings.includes("nlp_obfuscated_phone")) {
findings.push("nlp_obfuscated_phone");
}
}

const patternDigits = phonePatternMatch
? phonePatternMatch.join("").replace(/\D/g, "").length
: 0;
if (patternDigits + totalDigitsFromWords >= 10) {
if (
!findings.includes("hybrid_obfuscated_phone") &&
!findings.includes("phone") &&
!findings.includes("nlp_obfuscated_phone")
) {
findings.push("hybrid_obfuscated_phone");
}
}
}

export function checkMessageForContacts(content: string, options?: { allowUrls?: boolean }) {
const findings: string[] = [];
const normalizedContent = cleanAndNormalizeText(content);
  const phonePatternMatch = new RegExp(CONTACT_REGEX.phone.source, "g").exec(content);

checkBasicContacts(content, findings, options);
checkSocialAndUpi(content, normalizedContent, findings);
const wordCount = checkNumberWords(content, findings);
checkNlpContact(content, findings, wordCount, phonePatternMatch);

return {
hasContactInfo: findings.length > 0,
findings,
};
}

export function checkAttachmentForContacts(fileUrl: string) {
if (!fileUrl) return { hasContactInfo: false, findings: [] };

const findings: string[] = [];

// Extract filename from URL
let filename = "";
try {
const urlObj = new URL(fileUrl);
const pathname = urlObj.pathname;
filename = decodeURIComponent(pathname.substring(pathname.lastIndexOf("/") + 1));
} catch {
// Fallback to raw extraction if URL parsing fails
const lastSlash = fileUrl.lastIndexOf("/");
filename = decodeURIComponent(lastSlash !== -1 ? fileUrl.substring(lastSlash + 1) : fileUrl);
}

if (testRegex(CONTACT_REGEX.email, filename) || testRegex(CONTACT_REGEX.emailObfuscated, filename)) {
findings.push("attachment_email");
}

if (testRegex(CONTACT_REGEX.phone, filename)) {
findings.push("attachment_phone");
}

if (testRegex(CONTACT_REGEX.upi, filename)) {
findings.push("attachment_upi");
}

const normalizedFilename = cleanAndNormalizeText(filename);

if (
testRegex(CONTACT_REGEX.socialHandle, filename) ||
["whatsapp", "instagram", "telegram", "linktree", "gmailcom", "insta", "ig", "wp"].some((kw) =>
normalizedFilename.includes(kw),
)
) {
findings.push("attachment_social");
}

if (
normalizedFilename.includes("upiid") ||
normalizedFilename.includes("vpa") ||
normalizedFilename.includes("paytmme")
) {
findings.push("attachment_upi");
}

// Check if filename contains a contiguous block of 8+ digits (very likely a phone number or UPI)
if (/\d{8,}/.test(filename)) {
findings.push("attachment_digits");
}

return {
hasContactInfo: findings.length > 0,
findings,
};
}

export async function checkImageBufferForContacts(
  buffer: Buffer,
  filename: string
): Promise<{ hasContactInfo: boolean; findings: string[]; detectedText?: string }> {
  const apiKey = process.env.VISION_API_KEY;
  let detectedText = "";
  const findings: string[] = [];

  if (apiKey) {
    try {
      const base64Image = buffer.toString("base64");
      const res = await fetch(
        `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requests: [
              {
                image: { content: base64Image },
                features: [{ type: "TEXT_DETECTION" }],
              },
            ],
          }),
        }
      );

      if (res.ok) {
        const payload = await res.json();
        const fullText = payload.responses?.[0]?.fullTextAnnotation?.text;
        if (fullText) {
          detectedText = fullText;
        }
      } else {
        console.error("[Vision API Error] Failed to scan image", await res.text());
      }
    } catch (err) {
      console.error("[Vision API Exception] Failed to scan image", err);
    }
  } else {
    // Simulated/mock OCR fallback for testing:
    // If the file name contains keywords like "-leak", "contact", "phone", "email", "upi", or has specific cues, we block it.
    const lowerName = filename.toLowerCase();
    if (
      lowerName.includes("leak") ||
      lowerName.includes("contact") ||
      lowerName.includes("phone") ||
      lowerName.includes("email") ||
      lowerName.includes("upi") ||
      lowerName.includes("whatsapp") ||
      lowerName.includes("telegram") ||
      lowerName.includes("insta")
    ) {
      detectedText = `Mock OCR: detected contact info in image filename trigger: ${filename}`;
    }
  }

  if (detectedText) {
    const textCheck = checkMessageForContacts(detectedText, { allowUrls: true });
    if (textCheck.hasContactInfo) {
      findings.push(...textCheck.findings.map(f => `image_${f}`));
    }
  }

  const result: { hasContactInfo: boolean; findings: string[]; detectedText?: string } = {
    hasContactInfo: findings.length > 0,
    findings,
  };
  if (detectedText) {
    result.detectedText = detectedText;
  }
  return result;
}

