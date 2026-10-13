export type KYCStatus = "PENDING" | "VERIFIED" | "REJECTED" | "EXPIRED";

export interface KYCVerifyResult {
  success: boolean;
  status: KYCStatus;
  data?: {
    name?: string;
    gender?: string;
    dob?: string;
    address?: string;
    documentNumber?: string;
    category?: string;
    panType?: string;
    businessName?: string;
    clientId?: string;
    raw?: Record<string, unknown>;
  };
  error?: string;
  clientId?: string;
}

export interface BankVerifyResult {
  success: boolean;
  nameMatch: boolean;
  accountExists: boolean;
  beneficiaryName?: string;
  error?: string;
}

/**
 * Pluggable KYC Provider Interface
 * All KYC providers (Surepass, DigiLocker, Cashfree, Mock, Manual)
 * must implement this contract to decouple verification business logic.
 */
export interface KYCProvider {
  readonly name: string;
  verifyAadhaar(aadhaarNumber: string, userId?: string): Promise<KYCVerifyResult>;
  verifyAadhaarOTP?(clientId: string, otp: string): Promise<KYCVerifyResult>;
  verifyPAN(panNumber: string): Promise<KYCVerifyResult>;
  verifyGSTIN(gstin: string): Promise<KYCVerifyResult>;
  verifyBankAccount(accountNumber: string, ifsc: string, registeredName?: string): Promise<BankVerifyResult>;
}
