import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

// Validate environment variables at build time
import "./src/env";

function hostnameFromUrl(value?: string) {
  if (!value) return null;
  try {
    return new URL(value).hostname;
  } catch {
    return null;
  }
}

const storagePublicHost =
  hostnameFromUrl(process.env.STORAGE_PUBLIC_URL) ||
  hostnameFromUrl(process.env.R2_PUBLIC_URL);
const s3Bucket = process.env.S3_BUCKET;
const s3Region = process.env.S3_REGION || "ap-south-1";



const isVercel = process.env.VERCEL === "1";
const allowedDevOrigins = process.env.ALLOWED_DEV_ORIGINS
  ? Array.from(
    new Set(
      process.env.ALLOWED_DEV_ORIGINS.split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
  )
  : [];

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_PLATFORM_NAME: process.env.PLATFORM_NAME || process.env.NEXT_PUBLIC_PLATFORM_NAME || "",
    NEXT_PUBLIC_PLATFORM_LEGAL_NAME: process.env.PLATFORM_LEGAL_NAME || process.env.NEXT_PUBLIC_PLATFORM_LEGAL_NAME || "",
    NEXT_PUBLIC_PLATFORM_TRADE_NAME: process.env.PLATFORM_TRADE_NAME || process.env.NEXT_PUBLIC_PLATFORM_TRADE_NAME || "",
    NEXT_PUBLIC_PLATFORM_CONSTITUTION: process.env.PLATFORM_CONSTITUTION || process.env.NEXT_PUBLIC_PLATFORM_CONSTITUTION || "",
    NEXT_PUBLIC_PLATFORM_ADDRESS: process.env.PLATFORM_ADDRESS || process.env.NEXT_PUBLIC_PLATFORM_ADDRESS || "",
    NEXT_PUBLIC_PLATFORM_CITY: process.env.PLATFORM_CITY || process.env.NEXT_PUBLIC_PLATFORM_CITY || "",
    NEXT_PUBLIC_PLATFORM_STATE: process.env.PLATFORM_STATE || process.env.NEXT_PUBLIC_PLATFORM_STATE || "",
    NEXT_PUBLIC_PLATFORM_STATE_CODE: process.env.PLATFORM_STATE_CODE || process.env.NEXT_PUBLIC_PLATFORM_STATE_CODE || "",
    NEXT_PUBLIC_PLATFORM_PINCODE: process.env.PLATFORM_PINCODE || process.env.NEXT_PUBLIC_PLATFORM_PINCODE || "",
    NEXT_PUBLIC_PLATFORM_GSTIN: process.env.PLATFORM_GSTIN || process.env.NEXT_PUBLIC_PLATFORM_GSTIN || "",
    NEXT_PUBLIC_PLATFORM_PAN: process.env.PLATFORM_PAN || process.env.NEXT_PUBLIC_PLATFORM_PAN || "",
    NEXT_PUBLIC_PLATFORM_CIN: process.env.PLATFORM_CIN || process.env.NEXT_PUBLIC_PLATFORM_CIN || "",
    NEXT_PUBLIC_PLATFORM_UDYAM: process.env.PLATFORM_UDYAM || process.env.NEXT_PUBLIC_PLATFORM_UDYAM || "",
    NEXT_PUBLIC_PLATFORM_EMAIL: process.env.PLATFORM_EMAIL || process.env.NEXT_PUBLIC_PLATFORM_EMAIL || "",
    NEXT_PUBLIC_PLATFORM_OFFICIAL_EMAIL: process.env.PLATFORM_OFFICIAL_EMAIL || process.env.NEXT_PUBLIC_PLATFORM_OFFICIAL_EMAIL || "",
    NEXT_PUBLIC_PLATFORM_BILLING_EMAIL: process.env.PLATFORM_BILLING_EMAIL || process.env.NEXT_PUBLIC_PLATFORM_BILLING_EMAIL || "",
    NEXT_PUBLIC_PLATFORM_LEGAL_EMAIL: process.env.PLATFORM_LEGAL_EMAIL || process.env.NEXT_PUBLIC_PLATFORM_LEGAL_EMAIL || "",
    NEXT_PUBLIC_PLATFORM_PRIVACY_EMAIL: process.env.PLATFORM_PRIVACY_EMAIL || process.env.NEXT_PUBLIC_PLATFORM_PRIVACY_EMAIL || "",
    NEXT_PUBLIC_PLATFORM_GRIEVANCE_EMAIL: process.env.PLATFORM_GRIEVANCE_EMAIL || process.env.NEXT_PUBLIC_PLATFORM_GRIEVANCE_EMAIL || "",
    NEXT_PUBLIC_PLATFORM_GRIEVANCE_OFFICER: process.env.PLATFORM_GRIEVANCE_OFFICER || process.env.NEXT_PUBLIC_PLATFORM_GRIEVANCE_OFFICER || "",
    NEXT_PUBLIC_PLATFORM_PHONE: process.env.PLATFORM_PHONE || process.env.NEXT_PUBLIC_PLATFORM_PHONE || "",
    NEXT_PUBLIC_PLATFORM_WEBSITE: process.env.PLATFORM_WEBSITE || process.env.NEXT_PUBLIC_PLATFORM_WEBSITE || process.env.APP_URL || "",
    NEXT_PUBLIC_PLATFORM_PRIMARY_SAC: process.env.PLATFORM_PRIMARY_SAC || process.env.NEXT_PUBLIC_PLATFORM_PRIMARY_SAC || "",
  },
  reactStrictMode: true,
  poweredByHeader: false,
  devIndicators: false,
  allowedDevOrigins,
  ...(isVercel ? {} : { output: "standalone" as const }),
  compress: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === "production" ? { exclude: ["error", "warn"] } : false,
  },
  experimental: {
    optimizePackageImports: [
      "framer-motion",
      "date-fns",
      "recharts",
      "lucide-react",
      "swr",
      "@tanstack/react-virtual",
    ],
  },
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 31536000,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      ...(storagePublicHost
        ? [{ protocol: "https" as const, hostname: storagePublicHost }]
        : []),
      ...(s3Bucket
        ? [
          {
            protocol: "https" as const,
            hostname: `${s3Bucket}.s3.${s3Region}.amazonaws.com`,
          },
        ]
        : []),
    ],
  },
  async headers() {
    return [
      {
        source: '/(icon-.*|apple-touch-icon.*|logo.*|og-image.png|favicon.ico)',
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(self)",
          },
        ],
      },
    ];
  },
};

const sentryOrg = process.env.SENTRY_ORG;
const sentryProject = process.env.SENTRY_PROJECT;
const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN;

export default withSentryConfig(withBundleAnalyzer(nextConfig), {
  ...(sentryOrg ? { org: sentryOrg } : {}),
  ...(sentryProject ? { project: sentryProject } : {}),
  ...(sentryAuthToken ? { authToken: sentryAuthToken } : {}),
  silent: !sentryAuthToken || !process.env.CI,
  widenClientFileUpload: Boolean(sentryAuthToken && sentryOrg && sentryProject),
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },
  telemetry: false,
});
