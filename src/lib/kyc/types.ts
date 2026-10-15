export type KYCStatus = "PENDING" | "VERIFIED" | "REJECTED" | "EXPIRED";

export interface KYCVerifyResult {
  success: boolean;
  status: KYCStatus;
  data?: {
    name?: string | undefined;
    gender?: string | undefined;
    dob?: string | undefined;
    address?: string | undefined;
    documentNumber?: string | undefined;
    category?: string | undefined;
    panType?: string | undefined;
    businessName?: string | undefined;
    clientId?: string | undefined;
    raw?: Record<string, unknown> | undefined;
  };
  error?: string | undefined;
  clientId?: string | undefined;
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
