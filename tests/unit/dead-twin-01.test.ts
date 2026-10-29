import { describe, it, expect } from "vitest";
// Import from single canonical source
import {
  passwordChangeSchema as canonicalPasswordChange,
  taxComplianceSchema as canonicalTaxCompliance,
  resetPasswordSchema as canonicalResetPassword,
  bankAccountSchema as canonicalBankAccount,
  deleteAccountSchema as canonicalDeleteAccount,
  withdrawalSchema as canonicalWithdrawal,
  createDisputeSchema as canonicalCreateDispute,
  createSupportSchema as canonicalCreateSupport,
  campaignFormSchema as canonicalCampaignForm,
} from "@/lib/validations";

// Import from re-export barrel modules
import {
  passwordChangeSchema,
  taxComplianceSchema,
  resetPasswordSchema,
  bankAccountSchema,
  deleteAccountSchema,
} from "@/lib/validations/auth";
import {
  createCampaignSchema,
  createDisputeSchema,
  createSupportSchema,
} from "@/lib/validations/campaign";
import { withdrawalSchema } from "@/lib/validations/payment";

describe("DEAD-TWIN-01: Validations Single-Sourcing", () => {
  it("exports all auth schemas from canonical @/lib/validations and re-exports identity match", () => {
    expect(canonicalPasswordChange).toBeDefined();
    expect(passwordChangeSchema).toBe(canonicalPasswordChange);

    expect(canonicalTaxCompliance).toBeDefined();
    expect(taxComplianceSchema).toBe(canonicalTaxCompliance);

    expect(canonicalResetPassword).toBeDefined();
    expect(resetPasswordSchema).toBe(canonicalResetPassword);

    expect(canonicalBankAccount).toBeDefined();
    expect(bankAccountSchema).toBe(canonicalBankAccount);

    expect(canonicalDeleteAccount).toBeDefined();
    expect(deleteAccountSchema).toBe(canonicalDeleteAccount);
  });

  it("exports all campaign schemas from canonical @/lib/validations and re-exports identity match", () => {
    expect(canonicalCreateDispute).toBeDefined();
    expect(createDisputeSchema).toBe(canonicalCreateDispute);

    expect(canonicalCreateSupport).toBeDefined();
    expect(createSupportSchema).toBe(canonicalCreateSupport);

    expect(canonicalCampaignForm).toBeDefined();
    expect(createCampaignSchema).toBe(canonicalCampaignForm);
  });

  it("exports withdrawalSchema from canonical @/lib/validations and re-exports identity match", () => {
    expect(canonicalWithdrawal).toBeDefined();
    expect(withdrawalSchema).toBe(canonicalWithdrawal);
  });
});
