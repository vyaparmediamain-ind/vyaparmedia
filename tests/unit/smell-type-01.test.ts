import { describe, it, expect } from "vitest";
import { messageSchema } from "@/lib/validations";

describe("SMELL-TYPE-01: MessageType Validation & Client Safety", () => {
  const validClientTypes = [
    "TEXT",
    "IMAGE",
    "VIDEO",
    "DOCUMENT",
    "FILE",
    "PROPOSAL",
    "CONTRACT_ACCEPTANCE",
    "DEAL_TERMS",
    "PAYMENT_REQUEST",
    "APPROVAL",
    "OFFER",
  ] as const;

  it.each(validClientTypes)(
    "accepts client-sendable messageType '%s'",
    (type) => {
      const result = messageSchema.safeParse({
        receiverId: "cm1234567890",
        content: `Test message with ${type}`,
        messageType: type,
      });

      expect(result.success, `Expected messageType ${type} to be valid`).toBe(true);
      if (result.success) {
        expect(result.data.messageType).toBe(type);
      }
    },
  );

  it("strictly REJECTS client attempts to send SYSTEM messages", () => {
    const result = messageSchema.safeParse({
      receiverId: "cm1234567890",
      content: "Forged system notification",
      messageType: "SYSTEM",
    });

    expect(result.success, "Client must NOT be allowed to post SYSTEM messages").toBe(false);
  });
});
