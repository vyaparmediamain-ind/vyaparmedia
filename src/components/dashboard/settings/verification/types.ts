export interface VerificationData {
  verificationLevel?: string;
  trustScore?: number;
  tier?: number;
  tierLimit?: number | null;
  tierDescription?: string;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  userType?: string;
  documents?: {
    id: string;
    type: string;
    status: string;
    rejectionReason?: string;
  }[];
}
