/**
 * Re-exports from canonical validation module @/lib/validations
 * Maintains backward compatibility for consumers of @/lib/validations/auth
 */
export {
  registerSchema,
  loginSchema,
  passwordChangeSchema,
  taxComplianceSchema,
  resetPasswordSchema,
  bankAccountSchema,
  deleteAccountSchema,
} from "@/lib/validations";
