"use client";


import { logger } from "@/lib/logger-client";
import { useState, useMemo, useCallback } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { useSession } from "next-auth/react";
import DashboardShell from "@/components/dashboard/DashboardShell";
import BankAccountManager from "@/components/dashboard/wallet/BankAccountManager";
import TransactionHistory from "@/components/dashboard/wallet/TransactionHistory";
import { useTokenRefreshGuard } from "@/hooks/useTokenRefreshGuard";
import { formatCurrency } from "@/lib/utils-client";
import PeriodPickerModal, { type PeriodValue } from "@/components/dashboard/wallet/PeriodPickerModal";
import { ToastContainer, type ToastItem, type ToastType } from "@/components/ui/toast";
import { Button, Input, Modal } from "@/components/ui";
import { withdrawSchema } from "@/lib/validations/auth";
import { WalletHeader, WalletSummaryCards, type WalletData } from "@/components/dashboard/wallet/WalletHeader";

interface SelectedBankAccount {
id: string;
bankName: string;
accountName: string;
accountNumber: string;
upiId?: string;
}

const loadRazorpay = () => {
return new Promise<boolean>((resolve) => {
if (window.Razorpay) {
resolve(true);
return;
}

const existingScript = document.getElementById(
"razorpay-checkout-sdk",
) as HTMLScriptElement | null;

if (existingScript) {
existingScript.addEventListener("load", () => resolve(true), {
once: true,
});
existingScript.addEventListener("error", () => resolve(false), {
once: true,
});
return;
}

const script = document.createElement("script");
script.id = "razorpay-checkout-sdk";
script.src = "https://checkout.razorpay.com/v1/checkout.js";
script.onload = () => resolve(true);
script.onerror = () => resolve(false);
document.body.appendChild(script);
});
};

async function verifyRazorpayPayment(
paymentResponse: { razorpay_payment_id?: string; razorpay_order_id?: string; razorpay_signature?: string },
showToast: (type: ToastType, message: string) => void,
onSuccess: () => void,
) {
try {
const verifyRes = await fetch("/api/wallet/add-funds/verify", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({
razorpay_payment_id: paymentResponse.razorpay_payment_id,
razorpay_order_id: paymentResponse.razorpay_order_id,
razorpay_signature: paymentResponse.razorpay_signature,
}),
});
const verifyData = await verifyRes.json();
if (verifyData.success) {
showToast("success", "Funds added successfully.");
onSuccess();
} else {
showToast("error", "Payment verification failed. Please contact support.");
}
} catch (verifyError: unknown) {
showToast("error", (verifyError instanceof Error ? verifyError.message : String(verifyError)) || "Verification error");
}
}

async function extractDownloadError(res: Response): Promise<string> {
const errText = await res.text();
try {
const d = JSON.parse(errText);
if (d?.message) return d.message;
} catch {}
return `Download failed (${res.status})`;
}

function useWallet(session: ReturnType<typeof useSession>["data"], requireFreshSession: () => Promise<boolean>) {
const [activeTab, setActiveTab] = useState("overview");

const [showWithdrawModal, setShowWithdrawModal] = useState(false);
const [showAddFundsModal, setShowAddFundsModal] = useState(false);

const { data, isLoading, mutate: fetchWalletData } = useSWR<{
wallet?: WalletData;
data?: WalletData;
userType?: string;
}>(
session ? "/api/wallet" : null,
fetcher
);

const walletData: WalletData | null = useMemo(() => {
const wallet = data?.wallet || data?.data;
if (!wallet) return null;
return {
balance: Number(wallet.balance || 0),
pendingBalance: Number(wallet.pendingBalance || 0),
totalEarned: Number(wallet.totalEarned || 0),
totalWithdrawn: Number(wallet.totalWithdrawn || 0),
totalHeld: Number(wallet.totalHeld || 0),
totalSpent: Number(wallet.totalSpent || 0),
totalDeposited: Number(wallet.totalDeposited || 0),
};
}, [data]);

const userType = data?.userType || session?.user?.userType || null;

const [withdrawAmount, setWithdrawAmount] = useState("");
const [selectedAccount, setSelectedAccount] = useState<SelectedBankAccount | null>(null);
const [isWithdrawing, setIsWithdrawing] = useState(false);
const [isAddingFunds, setIsAddingFunds] = useState(false);

const [toasts, setToasts] = useState<ToastItem[]>([]);
const handleRemoveToast = useCallback((id: string) => {
setToasts(prev => prev.filter(t => t.id !== id));
}, []);
const showToast = useCallback((type: ToastType, message: string) => {
const id = String(Date.now());
setToasts(prev => [...prev, { id, type, message }]);
setTimeout(() => handleRemoveToast(id), 5000);
}, [handleRemoveToast]);

const handleWithdraw = async (e?: React.FormEvent) => {
if (e) e.preventDefault();
const fresh = await requireFreshSession();
if (!fresh) return;

if (!selectedAccount) {
showToast("error", "Please select a bank account");
return;
}

const withdrawRupees = Number(withdrawAmount);
const validation = withdrawSchema.safeParse({ amount: withdrawRupees });
if (!validation.success) {
showToast("error", validation.error.issues[0]?.message || "Invalid withdrawal amount.");
return;
}

const withdrawPaise = Math.round(withdrawRupees * 100);
if (!walletData || withdrawPaise > walletData.balance) {
showToast("error", "Withdrawal amount exceeds available balance.");
return;
}

setIsWithdrawing(true);
try {
  const generateIdempotencyKey = (): string => {
    if (typeof window !== "undefined" && window.crypto) {
      if (typeof window.crypto.randomUUID === "function") {
        return window.crypto.randomUUID();
      }
      if (typeof window.crypto.getRandomValues === "function") {
        const array = new Uint32Array(2);
        window.crypto.getRandomValues(array);
        const r1 = array[0] ?? 0;
        const r2 = array[1] ?? 0;
        return `${Date.now()}-${r1.toString(36)}-${r2.toString(36)}`;
      }
    }
    return `${Date.now()}-${Date.now() % 1000000}`;
  };

  const idempotencyKey = generateIdempotencyKey();

    const res = await fetch("/api/payments/withdraw", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
body: JSON.stringify({
amount: withdrawPaise,
bankAccountId: selectedAccount.id,
}),
});
const data = await res.json();

if (!res.ok) {
throw new Error(data?.message || data?.error || "Withdrawal failed");
}

showToast("success", data?.message || "Withdrawal initiated successfully.");
setShowWithdrawModal(false);
setWithdrawAmount("");
setSelectedAccount(null);
fetchWalletData();
} catch (error: unknown) {
showToast("error", (error instanceof Error ? error.message : String(error)) || "Withdrawal failed");
} finally {
setIsWithdrawing(false);
}
};

const handleAddFunds = async (e: React.FormEvent) => {
e.preventDefault();
const form = e.target as HTMLFormElement;
const amountInput = form.elements.namedItem("amount") as HTMLInputElement;
const amount = amountInput.value;

if (!amount) return;
if (!Number.isFinite(Number(amount)) || Number(amount) < 100) {
showToast("error", "Minimum add-funds amount is INR 100.");
return;
}

setIsAddingFunds(true);
try {
const sdkLoaded = await loadRazorpay();
if (!sdkLoaded) {
showToast("error", "Razorpay SDK failed to load");
return;
}

const response = await fetch("/api/wallet/add-funds", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ amount }),
});
const data = await response.json();

if (!response.ok) {
throw new Error(data?.message || data?.error || "Failed to create order");
}

    const options = {
      key: data.key,
      amount: data.amount,
      currency: data.currency,
      name: "VyaparMedia",
      description: "Add funds to wallet",
      order_id: data.orderId,
      handler: async function (paymentResponse: { razorpay_payment_id?: string; razorpay_order_id?: string; razorpay_signature?: string }) {
        await verifyRazorpayPayment(paymentResponse, showToast, () => {
          setShowAddFundsModal(false);
          fetchWalletData();
        });
      },
      modal: {
        ondismiss: function () {
          setIsAddingFunds(false);
        }
      },
      theme: { color: "#4f46e5" },
    };

const RazorpayConstructor = window.Razorpay;
const paymentObject = new RazorpayConstructor(options);
paymentObject.open();
} catch (error: unknown) {
showToast("error", (error instanceof Error ? error.message : String(error)) || "Payment failed");
} finally {
setIsAddingFunds(false);
}
};

const [isDownloading, setIsDownloading] = useState<Record<string, boolean>>({});

// Period picker modal state
type ModalConfig = { key: string; title: string; icon: React.ReactNode; type: "transactions" | "report"; urlBase: string; fallback: string; };
const [activePicker, setActivePicker] = useState<ModalConfig | null>(null);

const openPicker = (cfg: ModalConfig) => setActivePicker(cfg);
const closePicker = () => setActivePicker(null);

const downloadCsv = async (url: string, key: string, fallbackFilename: string) => {
  setIsDownloading(prev => ({ ...prev, [key]: true }));
  try {
    const res = await fetch(url);
    if (!res.ok) {
      const msg = await extractDownloadError(res);
      throw new Error(msg);
    }
    const blob = await res.blob();
    const disposition = res.headers.get("content-disposition") || "";
    const match = /filename="?([^";\n]+)"?/.exec(disposition);
    const filename = match?.[1]?.trim() ?? fallbackFilename;

    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    a.style.position = "fixed";
    a.style.left = "-9999px";
    a.style.top = "-9999px";
    document.body.appendChild(a);
    a.click();
    // Delay revoke so browser has time to start the download
    setTimeout(() => {
      URL.revokeObjectURL(blobUrl);
      a.remove();
    }, 5000);

    showToast("success", ` ${filename} downloaded`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Download failed";
    showToast("error", msg);
    logger.error("[download]", err instanceof Error ? err : String(err));
  } finally {
    setIsDownloading(prev => ({ ...prev, [key]: false }));
  }
};

const handlePeriodConfirm = (period: PeriodValue) => {
  if (!activePicker) return;
  const { key, urlBase, fallback, type } = activePicker;
  const params = new URLSearchParams({ format: "csv" });
  if (type === "report" && period.fy) {
    params.set("fy", period.fy);
  } else {
    if (period.startDate) params.set("startDate", period.startDate);
    if (period.endDate) params.set("endDate", period.endDate);
  }
  closePicker();
  downloadCsv(`${urlBase}?${params.toString()}`, key, fallback);
};

const handleDownloadCSV = () => openPicker({
  key: "txn",
  type: "transactions",
  icon: (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  ),
  title: "Download Transactions",
  urlBase: "/api/wallet/transactions",
  fallback: "transactions.csv",
});

const handleDownloadIncomeReport = () => openPicker({
  key: "income",
  type: "report",
  icon: (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  ),
  title: "Income Report (ITR)",
  urlBase: "/api/reports/influencer/income",
  fallback: "income-report.csv",
});

const handleDownloadSpendReport = () => openPicker({
  key: "spend",
  type: "report",
  icon: (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  ),
  title: "Spend Report (GST)",
  urlBase: "/api/reports/brand/spend",
  fallback: "spend-report.csv",
});

return {
activeTab,
setActiveTab,
showWithdrawModal,
setShowWithdrawModal,
showAddFundsModal,
setShowAddFundsModal,
walletData,
userType,
isLoading,
withdrawAmount,
setWithdrawAmount,
selectedAccount,
setSelectedAccount,
isWithdrawing,
isAddingFunds,
toasts,
handleRemoveToast,
showToast,
fetchWalletData,
handleWithdraw,
handleAddFunds,
isDownloading,
activePicker,
openPicker,
closePicker,
downloadCsv,
handlePeriodConfirm,
handleDownloadCSV,
handleDownloadIncomeReport,
handleDownloadSpendReport,
};
}



export default function WalletPage() {
const { data: session, status } = useSession();
const { requireFreshSession } = useTokenRefreshGuard();

const {
activeTab,
setActiveTab,
showWithdrawModal,
setShowWithdrawModal,
showAddFundsModal,
setShowAddFundsModal,
walletData,
userType,
isLoading,
withdrawAmount,
setWithdrawAmount,
selectedAccount,
setSelectedAccount,
isWithdrawing,
isAddingFunds,
toasts,
handleRemoveToast,
handleWithdraw,
handleAddFunds,
isDownloading,
activePicker,
closePicker,
handlePeriodConfirm,
handleDownloadCSV,
handleDownloadIncomeReport,
handleDownloadSpendReport,
} = useWallet(session, requireFreshSession);

if (status === "loading" || isLoading) {
return (
<DashboardShell user={session?.user || null}>
<div className="flex items-center justify-center min-h-60vh">
<span className="loading" />
</div>
</DashboardShell>
);
}

if (!session) {
return <div className="p-8 text-center">Unauthorized</div>;
}

if (!walletData) {
return <div className="p-8 text-center">Failed to load wallet data</div>;
}

return (
<DashboardShell user={session.user}>
{/* Period picker modal */}
{activePicker && (
<PeriodPickerModal
type={activePicker.type}
title={activePicker.title}
icon={activePicker.icon}
isLoading={!!isDownloading[activePicker.key]}
onConfirm={handlePeriodConfirm}
onClose={closePicker}
/>
)}

<ToastContainer toasts={toasts} onClose={handleRemoveToast} />
<div className="animate-fade-in">
<WalletHeader
userType={userType}
balance={walletData.balance}
isDownloading={isDownloading}
setShowWithdrawModal={setShowWithdrawModal}
setShowAddFundsModal={setShowAddFundsModal}
handleDownloadCSV={handleDownloadCSV}
handleDownloadIncomeReport={handleDownloadIncomeReport}
handleDownloadSpendReport={handleDownloadSpendReport}
/>

<WalletSummaryCards userType={userType} walletData={walletData} />

<div
  role="tablist"
  aria-label="Wallet sections"
  className="wallet-tabs-container"
>
  {[
    { id: "overview", label: "Overview", icon: "📊" },
    { id: "transactions", label: "Transactions", icon: "📜" },
    ...(userType === "INFLUENCER"
      ? [{ id: "accounts", label: "Bank Accounts", icon: "🏦" }]
      : [{ id: "payment-methods", label: "Payment Methods", icon: "💳" }]),
  ].map((tab) => (
    <button
      key={tab.id}
      type="button"
      role="tab"
      aria-selected={activeTab === tab.id}
      onClick={() => setActiveTab(tab.id)}
      className="wallet-tab-button"
      data-active={activeTab === tab.id ? "true" : "false"}
    >
      <span>{tab.icon}</span>
      <span>{tab.label}</span>
    </button>
  ))}
</div>

{(activeTab === "overview" || activeTab === "transactions") && <TransactionHistory />}

{activeTab === "accounts" && (
<div className="max-w-800">
<BankAccountManager />
</div>
)}

{activeTab === "payment-methods" && (
<div className="max-w-800">
<div className="card">
<h3 className="text-lg font-bold mb-2">
Payment Methods
</h3>
<p className="text-secondary text-sm">
You can save methods through Razorpay checkout for faster top-ups.
</p>
</div>
</div>
)}
</div>

<Modal
  open={showWithdrawModal}
  onClose={() => setShowWithdrawModal(false)}
  title="Request Withdrawal"
  maxWidth="540px"
>
  <div className="mb-6 p-4 bg-tertiary rounded-lg">
    <span className="text-sm text-secondary">Available Balance</span>
    <div className="text-2xl font-bold gradient-text">{formatCurrency(walletData?.balance || 0)}</div>
  </div>

  <div>
    <div className="mb-4">
      <Input
        id="withdraw-amount-input"
        type="number"
        label="Amount (INR)"
        min="500"
        max={(walletData?.balance || 0) / 100}
        value={withdrawAmount}
        onChange={(e) => setWithdrawAmount(e.target.value)}
        required
        placeholder="Minimum 500"
        fullWidth
      />
    </div>

    <div className="mb-6">
      <div className="label">Select Bank Account</div>
      {selectedAccount ? (
        <div className="p-3 border border-indigo-15 rounded-lg flex justify-between items-center bg-secondary">
          <div>
            <div className="font-bold">
              {selectedAccount.bankName === "UPI" ? "UPI Account" : selectedAccount.bankName}
            </div>
            <div className="text-xs text-secondary">
              {selectedAccount.bankName === "UPI"
                ? selectedAccount.upiId
                : `**** ${(selectedAccount.accountNumber || "----").slice(-4)}`}
            </div>
          </div>
          <Button
            type="button"
            aria-label="Change selected bank account"
            onClick={() => setSelectedAccount(null)}
            variant="ghost"
            className="text-xs text-rose"
          >
            Change
          </Button>
        </div>
      ) : (
        <div className="border border-border rounded-lg p-4 max-h-60 overflow-y-auto">
          <div className="mb-4 text-sm text-secondary">
            Select a saved account to receive funds:
          </div>
          <BankAccountManager
            onSelectAccount={(acc) => setSelectedAccount(acc as SelectedBankAccount)}
          />
        </div>
      )}
    </div>

    <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 mt-4">
      <Button
        type="button"
        variant="ghost"
        onClick={() => setShowWithdrawModal(false)}
      >
        Cancel
      </Button>
      <Button
        type="button"
        variant="primary"
        onClick={() => handleWithdraw()}
        disabled={!selectedAccount || !withdrawAmount || isWithdrawing}
      >
        {isWithdrawing ? "Processing..." : "Withdraw Funds"}
      </Button>
    </div>
  </div>
</Modal>

<Modal
  open={showAddFundsModal}
  onClose={() => setShowAddFundsModal(false)}
  title="Add Funds"
  maxWidth="480px"
>
  <form onSubmit={handleAddFunds}>
    <div className="mb-6">
      <Input
        id="add-funds-amount-input"
        name="amount"
        type="number"
        label="Amount (INR)"
        min="100"
        required
        placeholder="Enter amount"
        fullWidth
      />
    </div>
    <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 mt-4">
      <Button
        type="button"
        variant="ghost"
        disabled={isAddingFunds}
        onClick={() => setShowAddFundsModal(false)}
      >
        Cancel
      </Button>
      <Button type="submit" variant="primary" disabled={isAddingFunds}>
        {isAddingFunds ? "Processing..." : "Proceed to Pay"}
      </Button>
    </div>
  </form>
</Modal>
</DashboardShell>
);
}


