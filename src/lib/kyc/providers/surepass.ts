import { KYCProvider, KYCVerifyResult, BankVerifyResult } from "../types";
import { logger } from "../../logger";

const KYC_TIMEOUT_MS = 10_000;

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = KYC_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function maskDoc(val: string, showLast = 4): string {
  if (!val) return "";
  const clean = val.replace(/\s+/g, "");
  return "*".repeat(Math.max(0, clean.length - showLast)) + clean.slice(-showLast);
}

export class SurepassKYCProvider implements KYCProvider {
  readonly name = "surepass";
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey?: string, baseUrl = "https://kyc-api.surepass.io") {
    this.apiKey = apiKey || process.env.KYC_API_KEY || "";
    this.baseUrl = baseUrl;
  }

  private getHeaders() {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
    };
  }

  async verifyAadhaar(aadhaarNumber: string): Promise<KYCVerifyResult> {
    if (!this.apiKey) {
      return { success: false, status: "PENDING", error: "Surepass API key not configured" };
    }

    try {
      const res = await fetchWithTimeout(`${this.baseUrl}/api/v1/aadhaar-v2/generate-otp`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({ id_number: aadhaarNumber.replace(/\s+/g, "") }),
      });

      const data = await res.json();
      if (!data.success) {
        return {
          success: false,
          status: "REJECTED",
          error: data.message || "Aadhaar OTP generation failed",
        };
      }

      return {
        success: true,
        status: "PENDING",
        data: {
          documentNumber: maskDoc(aadhaarNumber, 4),
          clientId: data.data?.client_id,
        },
        clientId: data.data?.client_id,
      };
    } catch (err) {
      logger.error("Surepass Aadhaar verify error", err);
      return { success: false, status: "PENDING", error: "Verification provider unavailable" };
    }
  }

  async verifyAadhaarOTP(clientId: string, otp: string): Promise<KYCVerifyResult> {
    if (!this.apiKey) {
      return { success: false, status: "PENDING", error: "Surepass API key not configured" };
    }

    try {
      const res = await fetchWithTimeout(`${this.baseUrl}/api/v1/aadhaar-v2/submit-otp`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({ client_id: clientId, otp }),
      });

      const data = await res.json();
      if (data.success && data.data) {
        return {
          success: true,
          status: "VERIFIED",
          data: {
            name: data.data.full_name,
            gender: data.data.gender,
            dob: data.data.dob,
            address: data.data.address?.split(",")[0] || "",
            documentNumber: maskDoc(data.data.aadhaar_number || "", 4),
            raw: data.data,
          },
        };
      }

      return {
        success: false,
        status: "REJECTED",
        error: data.message || "Aadhaar OTP verification failed",
      };
    } catch (err) {
      logger.error("Surepass Aadhaar OTP submit error", err);
      return { success: false, status: "PENDING", error: "Verification provider unavailable" };
    }
  }

  async verifyPAN(panNumber: string): Promise<KYCVerifyResult> {
    if (!this.apiKey) {
      return { success: false, status: "PENDING", error: "Surepass API key not configured" };
    }

    try {
      const res = await fetchWithTimeout(`${this.baseUrl}/api/v1/pan/pan`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({ id_number: panNumber.toUpperCase() }),
      });

      if (!res.ok) {
        return { success: false, status: "PENDING", error: "Verification provider temporarily unavailable" };
      }

      const data = await res.json();
      if (data.success && data.data) {
        return {
          success: true,
          status: "VERIFIED",
          data: {
            name: data.data.full_name,
            category: data.data.category,
            panType: data.data.pan_type,
            documentNumber: maskDoc(panNumber, 4),
            raw: data.data,
          },
        };
      }

      return {
        success: false,
        status: "REJECTED",
        error: data.message || "PAN verification failed",
      };
    } catch (err) {
      logger.error("Surepass PAN verify error", err);
      return { success: false, status: "PENDING", error: "Verification provider unavailable" };
    }
  }

  async verifyGSTIN(gstin: string): Promise<KYCVerifyResult> {
    if (!this.apiKey) {
      return { success: false, status: "PENDING", error: "Surepass API key not configured" };
    }

    try {
      const res = await fetchWithTimeout(`${this.baseUrl}/api/v1/corporate/gstin`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({ id_number: gstin.toUpperCase() }),
      });

      if (!res.ok) {
        return { success: false, status: "PENDING", error: "Verification provider temporarily unavailable" };
      }

      const data = await res.json();
      if (data.success && data.data) {
        return {
          success: true,
          status: "VERIFIED",
          data: {
            businessName: data.data.trade_name || data.data.legal_name,
            documentNumber: gstin,
            raw: data.data,
          },
        };
      }

      return {
        success: false,
        status: "REJECTED",
        error: data.message || "GSTIN verification failed",
      };
    } catch (err) {
      logger.error("Surepass GST verify error", err);
      return { success: false, status: "PENDING", error: "Verification provider unavailable" };
    }
  }

  async verifyBankAccount(accountNumber: string, ifsc: string, registeredName?: string): Promise<BankVerifyResult> {
    if (!this.apiKey) {
      return { success: false, nameMatch: false, accountExists: false, error: "Surepass API key not configured" };
    }

    try {
      const res = await fetchWithTimeout(`${this.baseUrl}/api/v1/bank-verification/`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({
          id_number: accountNumber,
          ifsc: ifsc.toUpperCase(),
        }),
      });

      if (!res.ok) {
        return { success: false, nameMatch: false, accountExists: false, error: "Bank verification provider unavailable" };
      }

      const data = await res.json();
      if (data.success && data.data) {
        const beneficiaryName = data.data.full_name || "";
        const nameMatch = registeredName
          ? beneficiaryName.toLowerCase().includes(registeredName.toLowerCase()) ||
            registeredName.toLowerCase().includes(beneficiaryName.toLowerCase())
          : false;

        return {
          success: true,
          accountExists: data.data.account_exists !== false,
          beneficiaryName,
          nameMatch,
        };
      }

      return {
        success: false,
        nameMatch: false,
        accountExists: false,
        error: data.message || "Bank account verification failed",
      };
    } catch (err) {
      logger.error("Surepass bank verify error", err);
      return { success: false, nameMatch: false, accountExists: false, error: "Bank verification unavailable" };
    }
  }
}
