import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { checkImageBufferForContacts } from "@/lib/contact-filter";
import { getIpDetails, isVPNOrProxy, isReservedOrPrivateIp } from "@/lib/ipinfo";
import { redis } from "@/lib/redis";

describe("TP-06: Google Vision OCR Hardening & Sanitization", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, VISION_API_KEY: "AIzaSyFakeVisionTestApiKey12345" };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("sends API key via X-Goog-Api-Key header and NOT in the URL query string", async () => {
    let capturedUrl = "";
    let capturedHeaders: Record<string, string> = {};

    global.fetch = vi.fn().mockImplementation(async (url: string | URL | Request, init?: RequestInit) => {
      capturedUrl = String(url);
      capturedHeaders = (init?.headers || {}) as Record<string, string>;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          responses: [
            {
              fullTextAnnotation: { text: "Contact me on WhatsApp: +91 9876543210" },
            },
          ],
        }),
      } as unknown as Response;
    });

    const smallImageBuffer = Buffer.from("fake-png-binary-data");
    const result = await checkImageBufferForContacts(smallImageBuffer, "chat_screenshot.png");

    expect(capturedUrl).toBe("https://vision.googleapis.com/v1/images:annotate");
    expect(capturedUrl).not.toContain("key=");
    expect(capturedHeaders["X-Goog-Api-Key"]).toBe("AIzaSyFakeVisionTestApiKey12345");
    expect(result.hasContactInfo).toBe(true);
    expect(result.findings).toContain("image_phone");
  });

  it("enforces image size limit (4MB) before base64 conversion and skips OCR", async () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy;

    // 4MB + 1 byte
    const oversizedBuffer = Buffer.alloc(4 * 1024 * 1024 + 1);
    const result = await checkImageBufferForContacts(oversizedBuffer, "huge_photo.png");

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.hasContactInfo).toBe(false);
  });

  it("handles HTTP 403 quota exceeded gracefully without throwing and fails open", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => JSON.stringify({ error: { message: "Quota exceeded for Vision API" } }),
    } as unknown as Response);

    const smallImageBuffer = Buffer.from("sample-data");
    const result = await checkImageBufferForContacts(smallImageBuffer, "invoice.jpg");

    expect(result.hasContactInfo).toBe(false);
  });

  it("handles network timeout gracefully without throwing", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("The operation was aborted due to timeout"));

    const smallImageBuffer = Buffer.from("sample-data");
    const result = await checkImageBufferForContacts(smallImageBuffer, "payment_proof.png");

    expect(result.hasContactInfo).toBe(false);
  });
});

describe("TP-07: IP Intelligence (freeipapi) Hardening & Private Range Filtering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("identifies and filters private, loopback, CGNAT, and AWS/GCP cloud metadata IPs", () => {
    expect(isReservedOrPrivateIp("127.0.0.1")).toBe(true);
    expect(isReservedOrPrivateIp("10.0.4.12")).toBe(true);
    expect(isReservedOrPrivateIp("172.16.0.1")).toBe(true);
    expect(isReservedOrPrivateIp("172.31.255.255")).toBe(true);
    expect(isReservedOrPrivateIp("192.168.1.1")).toBe(true);
    expect(isReservedOrPrivateIp("169.254.169.254")).toBe(true); // Cloud metadata
    expect(isReservedOrPrivateIp("100.64.0.1")).toBe(true); // CGNAT
    expect(isReservedOrPrivateIp("::1")).toBe(true); // IPv6 loopback
    expect(isReservedOrPrivateIp("unknown")).toBe(true);
    expect(isReservedOrPrivateIp("invalid-ip-string")).toBe(true);

    // Public IPs should not be reserved
    expect(isReservedOrPrivateIp("8.8.8.8")).toBe(false);
    expect(isReservedOrPrivateIp("103.21.244.0")).toBe(false);
    expect(isReservedOrPrivateIp("1.1.1.1")).toBe(false);
  });

  it("skips HTTP call and returns null immediately for reserved/private IPs", async () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy;

    const details = await getIpDetails("169.254.169.254");
    expect(details).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("caches successful IP lookups for 24 hours (86400 seconds)", async () => {
    vi.spyOn(redis, "get").mockResolvedValue(null);
    const setexSpy = vi.spyOn(redis, "setex").mockResolvedValue("OK");

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ipAddress: "103.21.244.1",
        latitude: 19.076,
        longitude: 72.8777,
        cityName: "Mumbai",
        countryCode: "IN",
        isProxy: false,
      }),
    } as unknown as Response);

    const details = await getIpDetails("103.21.244.1");
    expect(details?.cityName).toBe("Mumbai");
    expect(setexSpy).toHaveBeenCalledWith("ipinfo:103.21.244.1", 86400, expect.any(String));
  });

  it("negative-caches failed provider responses for 5 minutes (300 seconds) to prevent hammering", async () => {
    vi.spyOn(redis, "get").mockResolvedValue(null);
    const setexSpy = vi.spyOn(redis, "setex").mockResolvedValue("OK");

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
    } as unknown as Response);

    const details = await getIpDetails("103.21.244.2");
    expect(details).toBeNull();
    expect(setexSpy).toHaveBeenCalledWith("ipinfo:103.21.244.2", 300, expect.stringContaining('"failed":true'));
  });

  it("isVPNOrProxy fails open and returns false when provider returns null or fails", async () => {
    vi.spyOn(redis, "get").mockResolvedValue(null);
    global.fetch = vi.fn().mockRejectedValue(new Error("Network ECONNRESET"));

    const isVpn = await isVPNOrProxy("103.21.244.3");
    expect(isVpn).toBe(false);
  });

  it("extracts trusted client IP prioritizing x-vercel-forwarded-for over standard headers", async () => {
    const { extractTrustedIp } = await import("@/lib/ipinfo");

    // Case 1: Vercel header present
    const headers1 = new Headers({
      "x-vercel-forwarded-for": "103.21.244.10",
      "x-forwarded-for": "192.168.1.1, 10.0.0.1",
    });
    expect(extractTrustedIp(headers1)).toBe("103.21.244.10");

    // Case 2: Vercel header is private/reserved, fall back to x-forwarded-for public IP
    const headers2 = new Headers({
      "x-vercel-forwarded-for": "127.0.0.1",
      "x-forwarded-for": "10.0.0.1, 103.21.244.20",
    });
    expect(extractTrustedIp(headers2)).toBe("103.21.244.20");

    // Case 3: All IPs reserved => unknown
    const headers3 = new Headers({
      "x-forwarded-for": "192.168.1.1, 10.0.0.1",
    });
    expect(extractTrustedIp(headers3)).toBe("unknown");
  });
});
