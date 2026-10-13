import { describe, it, expect } from "vitest";
import { validateWithdrawalAmount } from "@/components/dashboard/wallet/FullScreenWithdrawFlow";
import fs from "node:fs";
import path from "node:path";

describe("Audit P10 — Frontend, UX & Accessibility Regressions", () => {
  describe("P0-FE-01: Razorpay Double-Spend & Dismissal Handler", () => {
    it("attaches modal.ondismiss and payment.failed listeners in wallet page", () => {
      const walletPath = path.resolve(__dirname, "../../src/app/dashboard/wallet/page.tsx");
      const content = fs.readFileSync(walletPath, "utf-8");

      expect(content).toContain("modal: {");
      expect(content).toContain("ondismiss:");
      expect(content).toContain('rzp.on("payment.failed"');
      expect(content).toContain("setIsAddingFunds(false)");
      // Ensure there is no premature finally block immediately following rzp.open()
      const handleAddFundsBody = content.slice(
        content.indexOf("const handleAddFunds ="),
        content.indexOf("const withdrawalEligibility =")
      );
      expect(handleAddFundsBody).not.toMatch(/rzp\.open\(\);\s*\}\s*finally/);
    });
  });

  describe("P0-FE-02: Withdrawal Amount Parsing in Indian Locale (Comma Stripping)", () => {
    it("correctly parses Indian formatted amounts with commas", () => {
      // 50,000 rupees with balance of 10,000,000 paise (₹1,00,000)
      const res1 = validateWithdrawalAmount("50,000", 10000000);
      expect(res1.valid).toBe(true);
      expect(res1.error).toBeNull();

      // 1,00,000 rupees with balance of 10,000,000 paise (₹1,00,000)
      const res2 = validateWithdrawalAmount("1,00,000", 10000000);
      expect(res2.valid).toBe(true);
      expect(res2.error).toBeNull();

      // 5,000 rupees with whitespace
      const res3 = validateWithdrawalAmount(" 5,000 ", 1000000);
      expect(res3.valid).toBe(true);
      expect(res3.error).toBeNull();
    });

    it("correctly rejects amounts exceeding available balance despite commas", () => {
      // 50,000 rupees (5,000,000 paise) with balance of 4,000,000 paise (₹40,000)
      const res = validateWithdrawalAmount("50,000", 4000000);
      expect(res.valid).toBe(false);
      expect(res.error).toContain("Amount exceeds your available balance");
    });

    it("correctly rejects invalid non-numeric or sub-minimum inputs", () => {
      const resInvalid = validateWithdrawalAmount("abc", 5000000);
      expect(resInvalid.valid).toBe(false);
      expect(resInvalid.error).toContain("valid positive amount");

      const resSubMin = validateWithdrawalAmount("50", 5000000);
      expect(resSubMin.valid).toBe(false);
      expect(resSubMin.error).toContain("Minimum withdrawal amount is");
    });
  });

  describe("P1-FE-03: Service Worker Script Loading Error Prevention", () => {
    it("returns Response.error() in static asset catch handler to prevent SyntaxError crashes", () => {
      const swPath = path.resolve(__dirname, "../../public/sw.js");
      const content = fs.readFileSync(swPath, "utf-8");

      expect(content).toContain("isStaticAssetPath");
      expect(content).toContain("return Response.error();");
      // Verify static asset catch block uses Response.error()
      const staticAssetBlock = content.slice(content.indexOf("if (!isStaticAssetPath(url.pathname)) return;"));
      expect(staticAssetBlock).toContain("return Response.error();");
      expect(staticAssetBlock).not.toContain('new Response("Offline"');
    });
  });

  describe("P1-FE-04: Campaign Wizard Multi-Step URL & Draft Persistence", () => {
    it("synchronizes currentStep with query params and persists draft to sessionStorage", () => {
      const wizardPath = path.resolve(
        __dirname,
        "../../src/app/dashboard/campaigns/create/CreateCampaignClient.tsx"
      );
      const content = fs.readFileSync(wizardPath, "utf-8");

      expect(content).toContain("useSearchParams");
      expect(content).toContain("campaign_wizard_draft");
      expect(content).toContain("beforeunload");
      expect(content).toContain("sessionStorage.setItem");
      expect(content).toContain("sessionStorage.removeItem");
    });
  });

  describe("P1-FE-05: Mobile Numeric Keypad & SMS OTP Autofill", () => {
    it("configures inputMode='numeric' and autoComplete='one-time-code' on OTP inputs", () => {
      const otpPath = path.resolve(
        __dirname,
        "../../src/components/register/OtpFields.tsx"
      );
      const content = fs.readFileSync(otpPath, "utf-8");

      expect(content).toContain('id="email-otp-input"');
      expect(content).toContain('id="phone-otp-input"');
      expect(content).toContain('inputMode="numeric"');
      expect(content).toContain('autoComplete="one-time-code"');
      expect(content).toContain('pattern="[0-9]*"');
    });
  });

  describe("P1-FE-06: Creator Discovery Virtualization / Windowed Batching", () => {
    it("batches creator rendering in influencers page with visibleCount and Load More", () => {
      const influencersPath = path.resolve(
        __dirname,
        "../../src/app/dashboard/influencers/page.tsx"
      );
      const content = fs.readFileSync(influencersPath, "utf-8");

      expect(content).toContain("visibleCount");
      expect(content).toContain("setVisibleCount");
      expect(content).toContain("displayedCreators.slice(0, visibleCount)");
      expect(content).toContain("Load More Creators");
    });
  });

  describe("P1-FE-07 & P2-FE-10: Dynamic Analytics Chunking & Semantic Chart Tokens", () => {
    it("dynamically imports AdminAnalyticsView with ssr: false", () => {
      const clientPath = path.resolve(
        __dirname,
        "../../src/app/admin/analytics/AdminAnalyticsClient.tsx"
      );
      const content = fs.readFileSync(clientPath, "utf-8");

      expect(content).toContain("dynamic(");
      expect(content).toContain("ssr: false");
      expect(content).toContain("AdminAnalyticsSkeleton");
    });

    it("uses semantic CSS color tokens in AdminAnalyticsView rather than raw hex", () => {
      const viewPath = path.resolve(
        __dirname,
        "../../src/components/analytics/AdminAnalyticsView.tsx"
      );
      const content = fs.readFileSync(viewPath, "utf-8");

      expect(content).not.toContain('stopColor="#3b82f6"');
      expect(content).not.toContain('stopColor="#10b981"');
      expect(content).toContain('stopColor="hsl(var(--primary))"');
      expect(content).toContain('stopColor="hsl(var(--escrow))"');
      expect(content).toContain('stroke="hsl(var(--primary))"');
      expect(content).toContain('stroke="hsl(var(--verified))"');
    });
  });

  describe("P2-FE-08: Modal Accessible Focus Trap & Active Element Restore", () => {
    it("traps Tab key navigation and restores focus on modal close", () => {
      const modalPath = path.resolve(
        __dirname,
        "../../src/components/ui/Modal.tsx"
      );
      const content = fs.readFileSync(modalPath, "utf-8");

      expect(content).toContain('modalRef = React.useRef');
      expect(content).toContain('previousActiveElement = React.useRef');
      expect(content).toContain('e.key === "Tab"');
      expect(content).toContain('previousActiveElement.current.focus()');
    });
  });

  describe("P2-FE-09: Minimum Touch Target Size (44x44px)", () => {
    it("provides at least 44x44px touch targets on mobile and desktop sidebar sign out triggers", () => {
      const mobilePath = path.resolve(
        __dirname,
        "../../src/components/navigation/MobileSidebar.tsx"
      );
      const desktopPath = path.resolve(
        __dirname,
        "../../src/components/navigation/DesktopSidebar.tsx"
      );
      const mobileContent = fs.readFileSync(mobilePath, "utf-8");
      const desktopContent = fs.readFileSync(desktopPath, "utf-8");

      expect(mobileContent).toContain("min-w-[44px] min-h-[44px]");
      expect(desktopContent).toContain("min-w-[44px] min-h-[44px]");
    });
  });

  describe("P2-FE-11: Dashboard Not-Found Handler", () => {
    it("exists and provides navigation back to active dashboard areas", () => {
      const notFoundPath = path.resolve(
        __dirname,
        "../../src/app/dashboard/not-found.tsx"
      );
      expect(fs.existsSync(notFoundPath)).toBe(true);

      const content = fs.readFileSync(notFoundPath, "utf-8");
      expect(content).toContain("/dashboard");
      expect(content).toContain("/dashboard/campaigns");
      expect(content).toContain("/dashboard/deals");
      expect(content).toContain("/dashboard/wallet");
    });
  });

  describe("P2-FE-12: Service Worker User Cache Purging on Logout", () => {
    it("handles CLEAR_USER_CACHE in service worker and purges caches on secureLogout", () => {
      const swPath = path.resolve(__dirname, "../../public/sw.js");
      const logoutHookPath = path.resolve(
        __dirname,
        "../../src/hooks/useSecureSession.ts"
      );
      const swContent = fs.readFileSync(swPath, "utf-8");
      const hookContent = fs.readFileSync(logoutHookPath, "utf-8");

      expect(swContent).toContain("CLEAR_USER_CACHE");
      expect(hookContent).toContain("caches.keys()");
      expect(hookContent).toContain("CLEAR_USER_CACHE");
    });
  });
});
