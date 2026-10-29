import { KYCProvider, KYCVerifyResult, BankVerifyResult } from "../types";
import { logger } from "../../logger";

function maskDoc(val: string, showLast = 4): string {
  if (!val) return "";
  const clean = val.replace(/\s+/g, "");
  return "*".repeat(Math.max(0, clean.length - showLast)) + clean.slice(-showLast);
}

export class ManualKYCProvider implements KYCProvider {
  readonly name = "manual";

  async verifyAadhaar(aadhaarNumber: string): Promise<KYCVerifyResult> {
    logger.info("Manual KYC Provider: Aadhaar verification routed to admin manual review queue");
    return {
      success: true,
      status: "PENDING",
      data: {
        documentNumber: maskDoc(aadhaarNumber, 4),
      },
    };
  }

  async verifyAadhaarOTP(): Promise<KYCVerifyResult> {
    return {
      success: false,
      status: "PENDING",
      error: "OTP verification not applicable in manual mode",
    };
  }

  async verifyPAN(panNumber: string): Promise<KYCVerifyResult> {
    logger.info("Manual KYC Provider: PAN verification routed to admin manual review queue");
    return {
      success: true,
      status: "PENDING",
      data: {
        documentNumber: maskDoc(panNumber, 4),
      },
    };
  }

  async verifyGSTIN(gstin: string): Promise<KYCVerifyResult> {
    logger.info("Manual KYC Provider: GSTIN verification routed to admin manual review queue");
    return {
      success: true,
      status: "PENDING",
      data: {
        documentNumber: gstin,
      },
    };
  }

  async verifyBankAccount(accountNumber: string, _ifsc: string, registeredName?: string): Promise<BankVerifyResult> {
    logger.info("Manual KYC Provider: Bank account routed to admin manual review queue");
    return {
      success: true,
      accountExists: true,
      nameMatch: !!registeredName,
      beneficiaryName: registeredName || "Manual Review Required",
    };
  }
}
