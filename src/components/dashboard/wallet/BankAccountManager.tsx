import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import EmptyState from "@/components/ui/EmptyState";
import { logger } from "@/lib/logger-client";
import { Button, Input } from "@/components/ui";
import { z } from "zod";

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

interface BankAccount {
id: string;
accountName: string;
accountNumber: string;
ifscCode: string;
bankName: string;
isDefault: boolean;
upiId?: string;
}

function getDisplayAccountNumber(isUpi: boolean, upiId?: string | null, accountNumber?: string | null): string {
  if (isUpi) {
    return upiId || "";
  }
  if (accountNumber?.startsWith("•")) {
    return accountNumber;
  }
  const digits = accountNumber?.replace(/\D/g, "") || "";
  const last4 = digits.length >= 4 ? digits.slice(-4) : (accountNumber?.slice(-4) || "••••");
  return `••••  ••••  ${last4}`;
}

interface BankAccountsResponse {
accounts?: BankAccount[];
}

export default function BankAccountManager({
onSelectAccount,
}: Readonly<{
onSelectAccount?: (account: BankAccount) => void;
}>) {
const [showForm, setShowForm] = useState(false);
const [payoutType, setPayoutType] = useState<"bank" | "upi">("bank");
const [newAccount, setNewAccount] = useState({
accountName: "",
accountNumber: "",
ifscCode: "",
bankName: "",
upiId: "",
isDefault: false,
});
const [isSaving, setIsSaving] = useState(false);
const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

const { data, isLoading: loading, mutate: fetchAccounts } = useSWR<BankAccountsResponse>(
"/api/wallet/bank-accounts",
fetcher
);

const accounts: BankAccount[] = data?.accounts || [];

const showNotice = (message: string, type: "success" | "error" = "success") => {
setNotice({ type, message });
setTimeout(() => setNotice(null), 4000);
};

const handleAddAccount = async (e: React.FormEvent) => {
e.preventDefault();
setIsSaving(true);

const validation = bankAccountSchema.safeParse({
payoutType,
accountName: newAccount.accountName.trim(),
accountNumber: newAccount.accountNumber.trim(),
ifscCode: newAccount.ifscCode.trim().toUpperCase(),
bankName: newAccount.bankName.trim(),
upiId: newAccount.upiId.trim(),
});

if (!validation.success) {
setIsSaving(false);
showNotice(validation.error.issues[0]?.message || "Invalid bank account details", "error");
return;
}

try {
const payload = payoutType === "upi"
? {
accountName: newAccount.accountName.trim(),
upiId: newAccount.upiId.trim(),
isDefault: newAccount.isDefault,
}
: {
accountName: newAccount.accountName.trim(),
accountNumber: newAccount.accountNumber.trim(),
ifscCode: newAccount.ifscCode.trim().toUpperCase(),
bankName: newAccount.bankName.trim(),
upiId: newAccount.upiId.trim() || undefined,
isDefault: newAccount.isDefault,
};

const res = await fetch("/api/wallet/bank-accounts", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify(payload),
});
const data = await res.json();
if (res.ok) {
fetchAccounts();
setShowForm(false);
setPayoutType("bank");
setNewAccount({
accountName: "",
accountNumber: "",
ifscCode: "",
bankName: "",
upiId: "",
isDefault: false,
});
showNotice("Bank account added successfully!");
} else {
showNotice(data.error || "Failed to add account", "error");
}
} catch (error) {
logger.error("[bank-account] Failed to add account:", error);
showNotice("An error occurred", "error");
} finally {
setIsSaving(false);
}
};

const handleSetDefault = async (id: string) => {
try {
const res = await fetch(`/api/wallet/bank-accounts?id=${encodeURIComponent(id)}`, {
method: "PUT",
});
if (res.ok) {
fetchAccounts();
showNotice("Default bank account updated.");
} else {
const data = await res.json();
showNotice(data.error || "Failed to set default", "error");
}
} catch {
showNotice("An error occurred", "error");
}
};

const handleDeleteRequest = (id: string) => {
setDeleteConfirmId(id);
};

const handleDeleteConfirm = async () => {
if (!deleteConfirmId) return;
const id = deleteConfirmId;
setDeleteConfirmId(null);
try {
const res = await fetch(`/api/wallet/bank-accounts?id=${encodeURIComponent(id)}`, {
method: "DELETE",
});
if (res.ok) {
fetchAccounts();
showNotice("Account removed.");
} else {
showNotice("Failed to delete account", "error");
}
} catch (error) {
logger.error("[bank-account] Failed to delete account:", error);
}
};

if (loading) return <div className="loading"></div>;

return (
<div className="card">
<div
className="flex justify-between items-center mb-4"
>
<h3 className="text-lg font-bold">
Saved Bank Accounts
</h3>
<Button
variant="primary"
onClick={() => setShowForm(!showForm)}
>
{showForm ? "Cancel" : "+ Add Account"}
</Button>
</div>

{/* Inline notice */}
{notice && (
<div
className={`mb-3 text-sm font-semibold rounded-md px-3 py-2-5 ${
notice.type === "success"
? "bg-emerald-subtle text-emerald border-emerald-subtle"
: "bg-rose-subtle text-rose border-rose-subtle"
}`}
>
{notice.message}
</div>
)}

{/* Inline delete confirmation */}
{deleteConfirmId && (
<div
className="mb-3 rounded-md px-3 py-2-5 bg-rose-subtle border-rose-subtle"
>
<p className="text-sm font-semibold text-rose mb-2">
Are you sure you want to delete this bank account? This cannot be undone.
</p>
<div className="flex gap-2">
<Button variant="danger" onClick={handleDeleteConfirm}>
Yes, Delete
</Button>
<Button variant="secondary" onClick={() => setDeleteConfirmId(null)}>
Cancel
</Button>
</div>
</div>
)}

{showForm && (
<form
onSubmit={handleAddAccount}
className="p-4 mb-5 bg-tertiary rounded-md"
>
<div className="mb-4 flex gap-4">
<label className="flex items-center cursor-pointer text-sm font-semibold gap-1.5">
<input
type="radio"
name="payoutType"
checked={payoutType === "bank"}
onChange={() => setPayoutType("bank")}
/>{" "}Bank Account
</label>
<label className="flex items-center cursor-pointer text-sm font-semibold gap-1.5">
<input
type="radio"
name="payoutType"
checked={payoutType === "upi"}
onChange={() => setPayoutType("upi")}
/>{" "}UPI ID
</label>
</div>

<div className="grid-2">
<Input
id="bank-holder-name-input"
label="Account Holder Name"
required
value={newAccount.accountName}
onChange={(e) =>
setNewAccount({ ...newAccount, accountName: e.target.value })
}
fullWidth
/>
{payoutType === "bank" ? (
<>
<Input
id="bank-name-input"
label="Bank Name"
required
value={newAccount.bankName}
onChange={(e) =>
setNewAccount({ ...newAccount, bankName: e.target.value })
}
fullWidth
/>
<Input
id="bank-account-number-input"
label="Account Number"
required
value={newAccount.accountNumber}
onChange={(e) =>
setNewAccount({
...newAccount,
accountNumber: e.target.value,
})
}
fullWidth
/>
<Input
id="bank-ifsc-code-input"
label="IFSC Code"
required
value={newAccount.ifscCode}
onChange={(e) =>
setNewAccount({
...newAccount,
ifscCode: e.target.value.toUpperCase(),
})
}
fullWidth
/>
<Input
id="bank-upi-id-optional-input"
label="UPI ID (Optional)"
value={newAccount.upiId}
onChange={(e) =>
setNewAccount({ ...newAccount, upiId: e.target.value })
}
fullWidth
/>
</>
) : (
<Input
id="bank-upi-id-input"
label="UPI ID"
required
placeholder="username@bank"
value={newAccount.upiId}
onChange={(e) =>
setNewAccount({ ...newAccount, upiId: e.target.value })
}
fullWidth
/>
)}
<div className="flex items-center gap-2 pt-5">
<input
type="checkbox"
id="bank-is-default"
checked={newAccount.isDefault}
onChange={(e) =>
setNewAccount({ ...newAccount, isDefault: e.target.checked })
}
/>
<label htmlFor="bank-is-default" className="text-sm font-semibold cursor-pointer">
Set as default payout method
</label>
</div>
</div>
<div
className="mt-4 flex justify-end"
>
<Button
type="submit"
variant="primary"
disabled={isSaving}
>
{isSaving ? "Saving..." : "Save Account"}
</Button>
</div>
</form>
)}

        <div className="bank-cards-grid">
          {accounts.length === 0 && !showForm && (
            <EmptyState emoji="" title="No Bank Accounts" description="Add a bank account to enable withdrawals." compact />
          )}
          {accounts.map((acc) => {
            const isUpi = acc.bankName === "UPI";
            const displayAccount = getDisplayAccountNumber(isUpi, acc.upiId, acc.accountNumber);

            return (
              <div
                key={acc.id}
                data-default={acc.isDefault}
                className="fintech-bank-card"
              >
                {/* Top Row: Chip & Bank Name & Default Badge */}
                <div>
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className="bank-card-chip" />
                      <span className="font-extrabold text-lg text-white tracking-wide">
                        {acc.bankName || "Bank Account"}
                      </span>
                    </div>

                    {acc.isDefault ? (
                      <span className="text-3xs uppercase font-extrabold px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" aria-hidden="true" />
                        <span>Primary Account</span>
                      </span>
                    ) : (
                      <span className="text-3xs font-semibold px-2 py-0.5 rounded bg-white/5 text-muted border border-white/10">
                        Linked
                      </span>
                    )}
                  </div>

                  {/* Monospace Account Number */}
                  <div className="bank-card-number">
                    {displayAccount}
                  </div>
                </div>

                {/* Bottom Row: Beneficiary, IFSC, UPI & Actions */}
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className="bank-card-meta-pill">
                      Beneficiary: <strong className="text-white font-semibold">{acc.accountName}</strong>
                    </span>
                    {acc.ifscCode && (
                      <span className="bank-card-meta-pill font-mono">
                        IFSC: <strong className="text-cyan-400">{acc.ifscCode}</strong>
                      </span>
                    )}
                    {acc.upiId && !isUpi && (
                      <span className="bank-card-meta-pill">
                        UPI: <strong className="text-indigo-300">{acc.upiId}</strong>
                      </span>
                    )}
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center justify-between pt-3 border-t border-white/10 gap-2">
                    <div className="flex items-center gap-2">
                      {!acc.isDefault && (
                        <button
                          type="button"
                          onClick={() => handleSetDefault(acc.id)}
                          className="text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors bg-blue-500/10 hover:bg-blue-500/20 px-3 py-1.5 rounded-lg border border-blue-500/20 cursor-pointer"
                        >
                          ★ Make Primary
                        </button>
                      )}
                      {onSelectAccount && (
                        <button
                          type="button"
                          onClick={() => onSelectAccount(acc)}
                          className="text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors bg-emerald-500/10 hover:bg-emerald-500/20 px-3 py-1.5 rounded-lg border border-emerald-500/20 cursor-pointer"
                        >
                          Select
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteRequest(acc.id)}
                      className="text-xs font-semibold text-rose-400 hover:text-rose-300 transition-colors bg-rose-500/10 hover:bg-rose-500/20 px-3 py-1.5 rounded-lg border border-rose-500/20 cursor-pointer ml-auto"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
);
}
