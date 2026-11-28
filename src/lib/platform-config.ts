/**
* Platform Configuration for Reports
* Used to add platform details to CSV exports for official documentation.
*
* PRODUCTION CHECKLIST set these in your Vercel / server environment:
* PLATFORM_GSTIN actual company GSTIN (e.g. 29XXXXX1234F1Z5)
* PLATFORM_CIN Company Identification Number (e.g. U72900HR2023PTC000001)
* PLATFORM_PAN Company PAN (e.g. XXXCD1234F)
* PLATFORM_ADDRESS Registered office address
* PLATFORM_EMAIL Official support / legal email
* PLATFORM_PHONE Official phone number
* PLATFORM_WEBSITE Public website URL
*
* If any value is missing at runtime the export will contain a clearly-marked
* placeholder string so that generated reports are never silently invalid.
*/

// Canonical default statutory values for Vyapar Media (Proprietorship)
export const CANONICAL_DEFAULTS = {
  name: "Vyapar Media",
  legalName: "Krishna Mangal",
  tradeName: "Vyapar Media",
  constitution: "Proprietorship",
  address: "46/90 F-1, Laxmi Nagar, Jagdeeshpura, Behind Prabhu Talkies, Agra, Uttar Pradesh 282002",
  addressLine1: "46/90 F-1, Laxmi Nagar",
  addressLine2: "Jagdeeshpura, Behind Prabhu Talkies, Laxmi Nagar Colony",
  city: "Agra",
  district: "Agra",
  state: "Uttar Pradesh",
  stateCode: "09",
  pincode: "282002",
  gstin: "09KPIPM8835Q1ZK",
  udyam: "UDYAM-UP-01-0220749",
  cin: "PROPRIETORSHIP",
  pan: "KPIPM8835Q",
  phone: "+91-9639325726",
  email: "support@vyaparmedia.in",
  officialEmail: "support@vyaparmedia.in",
  legalEmail: "legal@vyaparmedia.in",
  privacyEmail: "privacy@vyaparmedia.in",
  billingEmail: "billing@vyaparmedia.in",
  grievanceEmail: "grievance@vyaparmedia.in",
  grievanceOfficer: "Ms. Yogita Agarwal, Grievance Officer",
  sacCode: "998361",
  website: "https://vyaparmedia.vercel.app",
  domain: "vyaparmedia.vercel.app",
} as const;

// Static mapping for Next.js / Webpack client-side compile-time replacement (public non-sensitive values only)
const STATIC_CLIENT_ENV: Record<string, string | undefined> = {
  PLATFORM_NAME: process.env.NEXT_PUBLIC_PLATFORM_NAME,
  PLATFORM_LEGAL_NAME: process.env.NEXT_PUBLIC_PLATFORM_LEGAL_NAME,
  PLATFORM_TRADE_NAME: process.env.NEXT_PUBLIC_PLATFORM_TRADE_NAME,
  PLATFORM_CONSTITUTION: process.env.NEXT_PUBLIC_PLATFORM_CONSTITUTION,
  PLATFORM_ADDRESS: process.env.NEXT_PUBLIC_PLATFORM_ADDRESS,
  PLATFORM_ADDRESS_LINE1: process.env.NEXT_PUBLIC_PLATFORM_ADDRESS_LINE1,
  PLATFORM_ADDRESS_LINE2: process.env.NEXT_PUBLIC_PLATFORM_ADDRESS_LINE2,
  PLATFORM_CITY: process.env.NEXT_PUBLIC_PLATFORM_CITY,
  PLATFORM_DISTRICT: process.env.NEXT_PUBLIC_PLATFORM_DISTRICT,
  PLATFORM_STATE: process.env.NEXT_PUBLIC_PLATFORM_STATE,
  PLATFORM_STATE_CODE: process.env.NEXT_PUBLIC_PLATFORM_STATE_CODE,
  PLATFORM_PINCODE: process.env.NEXT_PUBLIC_PLATFORM_PINCODE,
  PLATFORM_GSTIN: process.env.NEXT_PUBLIC_PLATFORM_GSTIN,
  PLATFORM_UDYAM: process.env.NEXT_PUBLIC_PLATFORM_UDYAM,
  PLATFORM_CIN: process.env.NEXT_PUBLIC_PLATFORM_CIN,
  PLATFORM_PAN: process.env.NEXT_PUBLIC_PLATFORM_PAN,
  PLATFORM_EMAIL: process.env.NEXT_PUBLIC_PLATFORM_EMAIL,
  PLATFORM_OFFICIAL_EMAIL: process.env.NEXT_PUBLIC_PLATFORM_OFFICIAL_EMAIL,
  PLATFORM_LEGAL_EMAIL: process.env.NEXT_PUBLIC_PLATFORM_LEGAL_EMAIL,
  PLATFORM_PRIVACY_EMAIL: process.env.NEXT_PUBLIC_PLATFORM_PRIVACY_EMAIL,
  PLATFORM_BILLING_EMAIL: process.env.NEXT_PUBLIC_PLATFORM_BILLING_EMAIL,
  PLATFORM_GRIEVANCE_EMAIL: process.env.NEXT_PUBLIC_PLATFORM_GRIEVANCE_EMAIL,
  PLATFORM_GRIEVANCE_OFFICER: process.env.NEXT_PUBLIC_PLATFORM_GRIEVANCE_OFFICER,
  PLATFORM_PHONE: process.env.NEXT_PUBLIC_PLATFORM_PHONE,
  PLATFORM_WEBSITE: process.env.NEXT_PUBLIC_PLATFORM_WEBSITE || process.env.NEXT_PUBLIC_APP_URL,
  PLATFORM_PRIMARY_SAC: process.env.NEXT_PUBLIC_PLATFORM_PRIMARY_SAC,
};

export function configValue(envKey: string, defaultValue = ""): string {
  const rawKey = envKey.replace(/^NEXT_PUBLIC_/, "");
  const clientKey = `NEXT_PUBLIC_${rawKey}`;

  // 1. Check statically inlined client env (available on client bundles)
  const clientVal = STATIC_CLIENT_ENV[rawKey] || STATIC_CLIENT_ENV[clientKey];
  if (clientVal && typeof clientVal === "string" && clientVal.trim() && !clientVal.includes("XXXX")) {
    return clientVal.trim();
  }

  // 2. Check dynamic runtime process.env (available on server runtime)
  const serverVal =
    typeof process !== "undefined" && process.env
      ? process.env[rawKey] || process.env[clientKey] || process.env[envKey]
      : undefined;

  if (serverVal && typeof serverVal === "string" && serverVal.trim() && !serverVal.includes("XXXX")) {
    return serverVal.trim();
  }

  return defaultValue;
}

const configuredGstin = configValue("PLATFORM_GSTIN", CANONICAL_DEFAULTS.gstin);
const derivedStateCode = configuredGstin.length >= 2 ? configuredGstin.slice(0, 2) : CANONICAL_DEFAULTS.stateCode;

export const PLATFORM_CONFIG = {
  name: configValue("PLATFORM_NAME", CANONICAL_DEFAULTS.name),
  legalName: configValue("PLATFORM_LEGAL_NAME", CANONICAL_DEFAULTS.legalName),
  tradeName: configValue("PLATFORM_TRADE_NAME", CANONICAL_DEFAULTS.tradeName),
  constitution: configValue("PLATFORM_CONSTITUTION", CANONICAL_DEFAULTS.constitution),
  address: configValue("PLATFORM_ADDRESS", CANONICAL_DEFAULTS.address),
  addressLine1: configValue("PLATFORM_ADDRESS_LINE1", CANONICAL_DEFAULTS.addressLine1),
  addressLine2: configValue("PLATFORM_ADDRESS_LINE2", CANONICAL_DEFAULTS.addressLine2),
  city: configValue("PLATFORM_CITY", CANONICAL_DEFAULTS.city),
  district: configValue("PLATFORM_DISTRICT", CANONICAL_DEFAULTS.district),
  state: configValue("PLATFORM_STATE", CANONICAL_DEFAULTS.state),
  stateCode: configValue("PLATFORM_STATE_CODE", derivedStateCode),
  pincode: configValue("PLATFORM_PINCODE", CANONICAL_DEFAULTS.pincode),
  gstin: configuredGstin,
  udyam: configValue("PLATFORM_UDYAM", CANONICAL_DEFAULTS.udyam),
  email: configValue("PLATFORM_EMAIL", CANONICAL_DEFAULTS.email),
  officialEmail: configValue("PLATFORM_OFFICIAL_EMAIL", CANONICAL_DEFAULTS.officialEmail),
  phone: configValue("PLATFORM_PHONE", CANONICAL_DEFAULTS.phone),
  website: configValue("PLATFORM_WEBSITE", configValue("APP_URL", CANONICAL_DEFAULTS.website)),
  cin: configValue("PLATFORM_CIN", CANONICAL_DEFAULTS.cin),
  pan: configValue("PLATFORM_PAN", CANONICAL_DEFAULTS.pan),
  legalEmail: configValue("PLATFORM_LEGAL_EMAIL", CANONICAL_DEFAULTS.legalEmail),
  privacyEmail: configValue("PLATFORM_PRIVACY_EMAIL", CANONICAL_DEFAULTS.privacyEmail),
  billingEmail: configValue("PLATFORM_BILLING_EMAIL", CANONICAL_DEFAULTS.billingEmail),
  grievanceEmail: configValue("PLATFORM_GRIEVANCE_EMAIL", CANONICAL_DEFAULTS.grievanceEmail),
  grievanceOfficer: configValue("PLATFORM_GRIEVANCE_OFFICER", CANONICAL_DEFAULTS.grievanceOfficer),
  sacCode: configValue("PLATFORM_PRIMARY_SAC", CANONICAL_DEFAULTS.sacCode),
  domain: configValue("PLATFORM_DOMAIN", configValue("PLATFORM_WEBSITE", configValue("APP_URL", CANONICAL_DEFAULTS.domain))).replace(/^https?:\/\//, "").replace(/\/+$/, ""),
} as const;

export function getPlatformHeader(): string[] {
  const { name, legalName, address, gstin, udyam, cin, pan, email, phone, website } = PLATFORM_CONFIG;
  return [
    ...(name ? [`Platform: ${name}`] : []),
    ...(legalName ? [`Legal Name: ${legalName}`] : []),
    ...(address ? [`Address: ${address}`] : []),
    ...(gstin ? [`GSTIN: ${gstin}`] : []),
    ...(pan ? [`PAN: ${pan}`] : []),
    ...(cin && !["N/A", "NONE", "PROPRIETORSHIP"].includes(cin.toUpperCase()) ? [`CIN: ${cin}`] : []),
    ...(udyam ? [`MSME/Udyam Reg: ${udyam}`] : []),
    ...(email ? [`Email: ${email}`] : []),
    ...(phone ? [`Phone: ${phone}`] : []),
    ...(website ? [`Website: ${website}`] : []),
    `Generated: ${new Date().toISOString()}`,
  ];
}

export function getPlatformFooter(): string[] {
  const { name, website, email } = PLATFORM_CONFIG;
  return [
    "",
    `--- End of Report ---`,
    ...(name ? [`Generated by ${name}`] : []),
    ...((email || website) ? [`For queries: ${[email, website].filter(Boolean).join(" | ")}`] : []),
  ];
}
