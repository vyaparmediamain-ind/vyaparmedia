import { KYCProvider, KYCVerifyResult, BankVerifyResult } from "../types";
import { logger } from "../../logger";
import { withCircuitBreaker } from "../../circuit-breaker";
import { trackSurepassDailySpend } from "../cache";

const KYC_TIMEOUT_MS = 10_000;
const PROVIDER_DOWN_MSG = "Verification abhi available nahi, thodi der baad try karein";

// Cost estimates per successful API call in INR (⚠️ verify in dashboard)
const COST_ESTIMATES = {
  AADHAAR_GENERATE_OTP: 3.0,
  AADHAAR_SUBMIT_OTP: 3.0,
  PAN_VERIFY: 2.0,
  GSTIN_VERIFY: 2.0,
  BANK_VERIFY: 4.0,
};

function maskDoc(val: string, showLast = 4): string {
  if (!val) return "";
  const clean = val.replace(/\s+/g, "");
  return "*".repeat(Math.max(0, clean.length - showLast)) + clean.slice(-showLast);
}

/**
 * Surepass KYC Provider
 * Official Documentation Links:
 * - Aadhaar OTP Generate: https://docs.surepass.io/docs/aadhaar-verification/aadhaar-v2-generate-otp (⚠️ verify in dashboard)
 * - Aadhaar OTP Submit: https://docs.surepass.io/docs/aadhaar-verification/aadhaar-v2-submit-otp (⚠️ verify in dashboard)
 * - PAN Verification: https://docs.surepass.io/docs/pan-verification/pan-comprehensive (⚠️ verify in dashboard)
 * - GSTIN Verification: https://docs.surepass.io/docs/gst-verification/gstin (⚠️ verify in dashboard)
 * - Bank Verification (Penny-drop): https://docs.surepass.io/docs/bank-account-verification/penny-drop (⚠️ verify in dashboard)
 */
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

  private async executeHttpRequest<T>(
    endpoint: string,
    body: Record<string, unknown>,
    actionName: string,
  ): Promise<T> {
    return withCircuitBreaker(
      "surepass:api",
      async () => {
        const res = await fetch(`${this.baseUrl}${endpoint}`, {
          method: "POST",
          headers: this.getHeaders(),
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(KYC_TIMEOUT_MS),
        });

        if (!res.ok) {
          const status = res.status;
          logger.warn(`[Surepass] HTTP status ${status} on ${actionName}`, {
            actionName,
            status,
          });
          const error = new Error(`Surepass API HTTP ${status}`);
          (error as unknown as { statusCode: number }).statusCode = status;
          throw error;
        }

        return (await res.json()) as T;
      },
      { failureThreshold: 5, resetTimeout: 60 },
    );
  }

  async verifyAadhaar(aadhaarNumber: string): Promise<KYCVerifyResult> {
    if (!this.apiKey) {
      return { success: false, status: "PENDING", error: "Surepass API key not configured" };
    }

    try {
      const cleanAadhaar = aadhaarNumber.replace(/\s+/g, "");
      const data = await this.executeHttpRequest<{
        success: boolean;
        message?: string;
        data?: { client_id?: string };
      }>("/api/v1/aadhaar-v2/generate-otp", { id_number: cleanAadhaar }, "aadhaar_generate_otp");

      if (!data.success) {
        return {
          success: false,
          status: "REJECTED",
          error: data.message || "Aadhaar OTP generation failed",
        };
      }

      await trackSurepassDailySpend(COST_ESTIMATES.AADHAAR_GENERATE_OTP);

      return {
        success: true,
        status: "PENDING",
        data: {
          documentNumber: maskDoc(cleanAadhaar, 4),
          clientId: data.data?.client_id,
        },
        clientId: data.data?.client_id,
      };
    } catch (err) {
      logger.error("Surepass Aadhaar verify failed", {
        action: "verifyAadhaar",
        error: err instanceof Error ? err.message : String(err),
      });
      return { success: false, status: "PENDING", error: PROVIDER_DOWN_MSG };
    }
  }

  async verifyAadhaarOTP(clientId: string, otp: string): Promise<KYCVerifyResult> {
    if (!this.apiKey) {
      return { success: false, status: "PENDING", error: "Surepass API key not configured" };
    }

    try {
      const data = await this.executeHttpRequest<{
        success: boolean;
        message?: string;
        data?: {
          full_name?: string;
          gender?: string;
          dob?: string;
          address?: string;
          aadhaar_number?: string;
          [key: string]: unknown;
        };
      }>("/api/v1/aadhaar-v2/submit-otp", { client_id: clientId, otp }, "aadhaar_submit_otp");

      if (data.success && data.data) {
        await trackSurepassDailySpend(COST_ESTIMATES.AADHAAR_SUBMIT_OTP);
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
      logger.error("Surepass Aadhaar OTP submit failed", {
        action: "verifyAadhaarOTP",
        clientId,
        error: err instanceof Error ? err.message : String(err),
      });
      return { success: false, status: "PENDING", error: PROVIDER_DOWN_MSG };
    }
  }

  async verifyPAN(panNumber: string): Promise<KYCVerifyResult> {
    if (!this.apiKey) {
      return { success: false, status: "PENDING", error: "Surepass API key not configured" };
    }

    try {
      const cleanPAN = panNumber.toUpperCase().trim();
      const data = await this.executeHttpRequest<{
        success: boolean;
        message?: string;
        data?: {
          full_name?: string;
          category?: string;
          pan_type?: string;
          [key: string]: unknown;
        };
      }>("/api/v1/pan/pan", { id_number: cleanPAN }, "pan_verify");

      if (data.success && data.data) {
        await trackSurepassDailySpend(COST_ESTIMATES.PAN_VERIFY);
        return {
          success: true,
          status: "VERIFIED",
          data: {
            name: data.data.full_name,
            category: data.data.category,
            panType: data.data.pan_type,
            documentNumber: maskDoc(cleanPAN, 4),
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
      logger.error("Surepass PAN verify failed", {
        action: "verifyPAN",
        maskedDoc: maskDoc(panNumber, 4),
        error: err instanceof Error ? err.message : String(err),
      });
      return { success: false, status: "PENDING", error: PROVIDER_DOWN_MSG };
    }
  }

  async verifyGSTIN(gstin: string): Promise<KYCVerifyResult> {
    if (!this.apiKey) {
      return { success: false, status: "PENDING", error: "Surepass API key not configured" };
    }

    try {
      const cleanGST = gstin.toUpperCase().trim();
      const data = await this.executeHttpRequest<{
        success: boolean;
        message?: string;
        data?: {
          trade_name?: string;
          legal_name?: string;
          [key: string]: unknown;
        };
      }>("/api/v1/corporate/gstin", { id_number: cleanGST }, "gstin_verify");

      if (data.success && data.data) {
        await trackSurepassDailySpend(COST_ESTIMATES.GSTIN_VERIFY);
        return {
          success: true,
          status: "VERIFIED",
          data: {
            businessName: data.data.trade_name || data.data.legal_name,
            documentNumber: cleanGST,
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
      logger.error("Surepass GST verify failed", {
        action: "verifyGSTIN",
        maskedDoc: maskDoc(gstin, 4),
        error: err instanceof Error ? err.message : String(err),
      });
      return { success: false, status: "PENDING", error: PROVIDER_DOWN_MSG };
    }
  }

  async verifyBankAccount(accountNumber: string, ifsc: string, registeredName?: string): Promise<BankVerifyResult> {
    if (!this.apiKey) {
      return { success: false, nameMatch: false, accountExists: false, error: "Surepass API key not configured" };
    }

    try {
      const cleanAccount = accountNumber.trim();
      const cleanIFSC = ifsc.toUpperCase().trim();
      const data = await this.executeHttpRequest<{
        success: boolean;
        message?: string;
        data?: {
          full_name?: string;
          account_exists?: boolean;
          [key: string]: unknown;
        };
      }>("/api/v1/bank-verification/", { id_number: cleanAccount, ifsc: cleanIFSC }, "bank_verify");

      if (data.success && data.data) {
        await trackSurepassDailySpend(COST_ESTIMATES.BANK_VERIFY);
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
      logger.error("Surepass bank verify failed", {
        action: "verifyBankAccount",
        maskedAccount: maskDoc(accountNumber, 4),
        ifsc,
        error: err instanceof Error ? err.message : String(err),
      });
      return { success: false, nameMatch: false, accountExists: false, error: PROVIDER_DOWN_MSG };
    }
  }
}
