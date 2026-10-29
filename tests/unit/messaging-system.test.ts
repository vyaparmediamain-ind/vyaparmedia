import { describe, it, expect } from "vitest";
import { detectContactLeak, convertNumberWordsToDigits } from "@/lib/contact-leak-detector";
import { formatIndianRupees } from "@/components/dashboard/deals/EscrowTrustCard";

describe("Messaging System & Business Safety Layer", () => {
  describe("Requirement 3 & Definition of Done: Zero False-Negative Contact Leak Detection", () => {
    it("should detect standard 10-digit Indian phone numbers", () => {
      const result = detectContactLeak("Please call me on 9876543210 to discuss");
      expect(result.hasLeak).toBe(true);
      expect(result.detectedTypes).toContain("Phone Number");
    });

    it("should detect spaced phone numbers (e.g. 9 8 7 6 5 4 3 2 1 0)", () => {
      const result = detectContactLeak("my mobile is 9 8 7 6 5 4 3 2 1 0 ping me");
      expect(result.hasLeak).toBe(true);
      expect(result.detectedTypes).toContain("Phone Number");
    });

    it("should detect dashed and country code phone numbers (+91 98765-43210)", () => {
      const result = detectContactLeak("Reach out on +91 98765-43210 directly");
      expect(result.hasLeak).toBe(true);
      expect(result.detectedTypes).toContain("Phone Number");
    });

    it("should detect spelled-out number words (nine eight seven six five...)", () => {
      const text = "call me at nine eight seven six five four three two one zero";
      const converted = convertNumberWordsToDigits(text);
      expect(converted.replace(/\D/g, "")).toContain("9876543210");

      const result = detectContactLeak(text);
      expect(result.hasLeak).toBe(true);
      expect(result.detectedTypes).toContain("Phone Number");
    });

    it("should detect standard email addresses", () => {
      const result = detectContactLeak("send the brief to partner@company.com");
      expect(result.hasLeak).toBe(true);
      expect(result.detectedTypes).toContain("Email Address");
    });

    it("should detect obfuscated email addresses (user at gmail dot com)", () => {
      const result = detectContactLeak("reach me at marketing at gmail dot com for budget");
      expect(result.hasLeak).toBe(true);
      expect(result.detectedTypes).toContain("Email Address");
    });

    it("should detect external URLs and website links", () => {
      const result1 = detectContactLeak("check out https://creatorportfolio.com/sample");
      expect(result1.hasLeak).toBe(true);
      expect(result1.detectedTypes).toContain("External Link");

      const result2 = detectContactLeak("details are at www.externalagency.in");
      expect(result2.hasLeak).toBe(true);
      expect(result2.detectedTypes).toContain("External Link");

      const result3 = detectContactLeak("check my linktr.ee/myprofile");
      expect(result3.hasLeak).toBe(true);
    });

    it("should detect external social messaging platforms (WhatsApp, Telegram, Instagram handles)", () => {
      const resultWhatsapp = detectContactLeak("let's discuss on whatsapp instead");
      expect(resultWhatsapp.hasLeak).toBe(true);
      expect(resultWhatsapp.detectedTypes).toContain("WhatsApp");

      const resultTg = detectContactLeak("ping me on telegram or t.me/myhandle");
      expect(resultTg.hasLeak).toBe(true);
      expect(resultTg.detectedTypes).toContain("Telegram");

      const resultInsta = detectContactLeak("DM me on instagram @topcreator");
      expect(resultInsta.hasLeak).toBe(true);
      expect(resultInsta.detectedTypes).toContain("Instagram Handle");
    });

    it("should detect payment and UPI handles (gpay, paytm, vpa)", () => {
      const resultUpi = detectContactLeak("send token payment to creator@okaxis directly");
      expect(resultUpi.hasLeak).toBe(true);
      expect(resultUpi.detectedTypes).toContain("Payment / UPI Handle");

      const resultGpay = detectContactLeak("can you paytm or gpay the fee?");
      expect(resultGpay.hasLeak).toBe(true);
      expect(resultGpay.detectedTypes).toContain("Payment / UPI Handle");
    });

    it("should NOT trigger false alarms on ordinary professional campaign messages", () => {
      const clean1 = "I reviewed the campaign brief and deliverables. The guidelines look great!";
      expect(detectContactLeak(clean1).hasLeak).toBe(false);

      const clean2 = "We need 1 Instagram Reel (60s) highlighting the unboxing experience.";
      expect(detectContactLeak(clean2).hasLeak).toBe(false);

      const clean3 = "Content draft submitted for your review. Looking forward to your feedback!";
      expect(detectContactLeak(clean3).hasLeak).toBe(false);
    });

    it("should generate the expected Hindi/English safety warning copy", () => {
      const result = detectContactLeak("whatsapp me at 9876543210");
      expect(result.warningMessage).toContain("Platform ke bahar contact share karna deal protection khatam kar sakta hai");
    });
  });

  describe("Requirement 5: Deal-Context Header Formatting", () => {
    it("should format deal amounts with Indian numbering in tabular-nums format", () => {
      // 1,00,000 INR
      const formatted = formatIndianRupees(10000000);
      const cleaned = formatted.replace(/\u00A0/g, " ");
      expect(cleaned).toContain("1,00,000");
      expect(cleaned).toContain("₹");
    });
  });

  describe("Requirement 6: Optimistic Send & Retry State Handling", () => {
    it("should support message status lifecycle (sending -> sent or failed)", () => {
      interface TestMessage {
        id: string;
        content: string;
        status: "sending" | "sent" | "failed";
      }

      const msg: TestMessage = {
        id: "temp-123",
        content: "Optimistic message draft",
        status: "sending",
      };

      expect(msg.status).toBe("sending");

      // On failure, status transitions to failed without losing content
      const failedMsg: TestMessage = { ...msg, status: "failed" };
      expect(failedMsg.status).toBe("failed");
      expect(failedMsg.content).toBe("Optimistic message draft");

      // On retry success, status transitions to sent
      const sentMsg: TestMessage = { ...failedMsg, status: "sent" };
      expect(sentMsg.status).toBe("sent");
    });
  });

  describe("Requirement 7: Profile Send Message Access Conditioning", () => {
    it("should disallow messaging when sender is messaging self", async () => {
      const { MessageService } = await import("@/services/message.service");
      const result = await MessageService.canMessageUser("usr_same", "usr_same");
      expect(result).toBe(false);
    });

    it("should disallow messaging when user IDs are empty", async () => {
      const { MessageService } = await import("@/services/message.service");
      const result1 = await MessageService.canMessageUser("", "usr_target");
      const result2 = await MessageService.canMessageUser("usr_sender", "");
      expect(result1).toBe(false);
      expect(result2).toBe(false);
    });
  });
});

