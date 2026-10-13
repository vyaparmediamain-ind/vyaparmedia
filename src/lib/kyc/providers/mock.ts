import { KYCProvider, KYCVerifyResult, BankVerifyResult } from "../types";

function maskDoc(val: string, showLast = 4): string {
  if (!val) return "";
  const clean = val.replace(/\s+/g, "");
  return "*".repeat(Math.max(0, clean.length - showLast)) + clean.slice(-showLast);
}

export class MockKYCProvider implements KYCProvider {
  readonly name = "mock";

  async verifyAadhaar(aadhaarNumber: string): Promise<KYCVerifyResult> {
    const clean = aadhaarNumber.replace(/\s+/g, "");
    if (clean.length !== 12) {
      return { success: false, status: "REJECTED", error: "Invalid Aadhaar number" };
    }
    return {
      success: true,
      status: "VERIFIED",
      data: {
        name: "Priya Sharma",
        gender: "F",
        dob: "2000-05-15",
        address: "Flat 402, Green Glen Layout, Bellandur, Bengaluru, Karnataka 560103",
        documentNumber: maskDoc(aadhaarNumber, 4),
      },
    };
  }

  async verifyAadhaarOTP(clientId: string, otp: string): Promise<KYCVerifyResult> {
    if (otp !== "123456") {
      return { success: false, status: "REJECTED", error: "Invalid OTP" };
    }
    return {
      success: true,
      status: "VERIFIED",
      data: {
        name: "Priya Sharma",
        gender: "F",
        dob: "2000-05-15",
        address: "Flat 402, Green Glen Layout, Bellandur, Bengaluru, Karnataka 560103",
        documentNumber: "****9012",
      },
    };
  }

  async verifyPAN(panNumber: string): Promise<KYCVerifyResult> {
    const pan = panNumber.toUpperCase().trim();
    if (!/^[A-Z]{5}\d{4}[A-Z]$/.test(pan)) {
      return { success: false, status: "REJECTED", error: "Invalid PAN format" };
    }
    return {
      success: true,
      status: "VERIFIED",
      data: {
        name: "Priya Sharma",
        category: "Individual",
        panType: "P",
        documentNumber: maskDoc(pan, 4),
      },
    };
  }

  async verifyGSTIN(gstin: string): Promise<KYCVerifyResult> {
    const gst = gstin.toUpperCase().trim();
    if (!/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[\dA-Z]$/.test(gst)) {
      return { success: false, status: "REJECTED", error: "Invalid GST format" };
    }
    return {
      success: true,
      status: "VERIFIED",
      data: {
        businessName: "Aura Lifestyle Brands Pvt Ltd",
        documentNumber: gst,
      },
    };
  }

  async verifyBankAccount(accountNumber: string, ifsc: string, registeredName?: string): Promise<BankVerifyResult> {
    const beneficiaryName = registeredName || "Priya Sharma";
    return {
      success: true,
      accountExists: true,
      beneficiaryName,
      nameMatch: true,
    };
  }
}
