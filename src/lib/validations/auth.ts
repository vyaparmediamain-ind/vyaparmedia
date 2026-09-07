import { z } from "zod";
import { phoneSchema, emailSchema, passwordSchema } from "@/lib/validations";
import { MIN_WITHDRAWAL_AMOUNT_RUPEES } from "@/lib/constants";

export const registerSchema = z.object({
name: z.string().min(2, "Name must be at least 2 characters").max(80, "Name cannot exceed 80 characters"),
email: emailSchema,
phone: phoneSchema,
password: passwordSchema,
confirmPassword: z.string(),
referralCode: z.string().optional(),
agreeToTerms: z.literal(true, {
message: "You must agree to the Terms of Service and Privacy Policy",
}),
}).refine((data) => data.password === data.confirmPassword, {
message: "Passwords do not match",
path: ["confirmPassword"],
});

export const loginSchema = z.object({
email: emailSchema,
password: z.string().min(1, "Password is required"),
twoFactorCode: z.string().length(6, "2FA code must be 6 digits").optional().or(z.literal("")),
});

export const passwordChangeSchema = z.object({
currentPassword: z.string().min(1, "Current password is required"),
newPassword: passwordSchema,
confirmNewPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmNewPassword, {
message: "New passwords do not match",
path: ["confirmNewPassword"],
});

export const taxComplianceSchema = z.object({
pan: z.string().regex(/^[A-Z]{5}\d{4}[A-Z]$/, "Invalid PAN format (e.g. ABCDE1234F)").or(z.literal("")),
gstin: z
.string()
.regex(/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, "Invalid GSTIN format (15 characters)")
.or(z.literal("")),
});

export const resetPasswordSchema = z.object({
password: passwordSchema,
confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
message: "Passwords do not match",
path: ["confirmPassword"],
});

export const bankAccountSchema = z.object({
payoutType: z.enum(["bank", "upi"]),
accountName: z.string().min(2, "Beneficiary name must be at least 2 characters").max(100, "Beneficiary name cannot exceed 100 characters"),
accountNumber: z.string().optional().or(z.literal("")),
ifscCode: z.string().optional().or(z.literal("")),
bankName: z.string().optional().or(z.literal("")),
upiId: z.string().optional().or(z.literal("")),
}).superRefine((data, ctx) => {
if (data.payoutType === "bank") {
if (!data.accountNumber || data.accountNumber.length < 9 || data.accountNumber.length > 18 || !/^\d+$/.test(data.accountNumber)) {
ctx.addIssue({
code: z.ZodIssueCode.custom,
message: "Please enter a valid 9 to 18 digit account number",
path: ["accountNumber"],
});
}
if (!data.ifscCode || !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(data.ifscCode)) {
ctx.addIssue({
code: z.ZodIssueCode.custom,
message: "Please enter a valid 11-digit IFSC code (e.g. SBIN0001234)",
path: ["ifscCode"],
});
}
if (!data.bankName || data.bankName.length < 2) {
ctx.addIssue({
code: z.ZodIssueCode.custom,
message: "Please enter a valid bank name",
path: ["bankName"],
});
}
} else if (data.payoutType === "upi") {
if (!data.upiId || !/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(data.upiId)) {
ctx.addIssue({
code: z.ZodIssueCode.custom,
message: "Please enter a valid UPI ID (e.g. user@okaxis)",
path: ["upiId"],
});
}
}
});

export const deleteAccountSchema = z.object({
confirmText: z.literal("DELETE", {
message: "Please type DELETE to confirm",
}),
password: z.string().min(1, "Password is required to delete your account"),
reason: z.string().max(500, "Reason cannot exceed 500 characters").optional(),
});

export const withdrawSchema = z.object({
  amount: z
    .number({ message: "Withdrawal amount must be a number" })
    .min(
      MIN_WITHDRAWAL_AMOUNT_RUPEES,
      `Minimum withdrawal amount is INR ${MIN_WITHDRAWAL_AMOUNT_RUPEES}`,
    ),
});
