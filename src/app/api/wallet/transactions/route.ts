import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { TransactionStatus, TransactionType } from "@prisma/client";
import { apiWrapper, ApiResponse } from "@/lib/api-wrapper";
import { WalletService } from "@/services/wallet.service";
import { auth } from "@/lib/auth";
import { csvResponse, paiseToRupees } from "@/lib/csv-export";
import { format } from "date-fns";
import prisma from "@/lib/db";
import { isInfluencer } from "@/lib/rbac";
import { PLATFORM_CONFIG } from "@/lib/platform-config";

const preprocessNumeric = (val: unknown) => {
if (val === undefined || val === null || val === "") return undefined;
const num = Number(val);
return Number.isNaN(num) ? undefined : num;
};

const querySchema = z.object({
page: z.preprocess(preprocessNumeric, z.number().int().min(1).default(1)),
limit: z.preprocess(preprocessNumeric, z.number().int().min(1).max(100).default(20)),
type: z.nativeEnum(TransactionType).optional(),
status: z.nativeEnum(TransactionStatus).optional(),
startDate: z.string().optional(),
endDate: z.string().optional(),
}).superRefine((data, ctx) => {
const startTs = data.startDate ? Date.parse(data.startDate) : Number.NaN;
const endTs = data.endDate ? Date.parse(data.endDate) : Number.NaN;

if (data.startDate && Number.isNaN(startTs)) {
ctx.addIssue({
code: z.ZodIssueCode.custom,
path: ["startDate"],
message: "Invalid startDate",
});
}

if (data.endDate && Number.isNaN(endTs)) {
ctx.addIssue({
code: z.ZodIssueCode.custom,
path: ["endDate"],
message: "Invalid endDate",
});
}

if (!Number.isNaN(startTs) && !Number.isNaN(endTs) && startTs > endTs) {
ctx.addIssue({
code: z.ZodIssueCode.custom,
path: ["endDate"],
message: "endDate must be greater than or equal to startDate",
});
}
});

interface CsvTxn {
  id?: string;
  createdAt: Date | string;
  type: string;
  amount: number;
  status: string;
  description: string | null;
}

function buildTransactionsCsv(
user: {
email: string;
userType: string;
},
displayName: string,
location: string,
txns: CsvTxn[],
filterDesc: string,
totalCredit: number,
totalDebit: number
): string {
const esc = (v: string) => v.includes(",") ? `"${v.replaceAll('"', '""')}"` : v;
const row = (label: string, value: string) => `${esc(label)},${esc(value)}\r\n`;
const sep = () => `\r\n`;
const title = (t: string) => `${esc(t)},\r\n`;

let csv = "";

// Platform header (RazorpayX / Stripe Benchmark)
csv += row(PLATFORM_CONFIG.legalName.toUpperCase(), "");
csv += row(`CIN: ${PLATFORM_CONFIG.cin}`, `GSTIN: ${PLATFORM_CONFIG.gstin}`);
csv += row("Registered Address", PLATFORM_CONFIG.address);
csv += row("OFFICIAL WALLET FINANCIAL STATEMENT & ESCROW LEDGER", "");
csv += row("Website", PLATFORM_CONFIG.website);
csv += row("Billing & Support", PLATFORM_CONFIG.billingEmail);
csv += sep();

// Report metadata
csv += title("STATEMENT PARAMETERS");
csv += row("Document Type", "Escrow & Wallet Ledger Statement");
csv += row("Statement Generated", format(new Date(), "dd/MM/yyyy HH:mm") + " IST");
csv += row("Scope / Filter", filterDesc);
csv += row("Total Records", String(txns.length));
csv += row("Base Currency", "INR (Indian Rupee)");
csv += sep();

// Account holder
csv += title("ACCOUNT HOLDER DOSSIER");
csv += row("Account Name", displayName || "Verified Platform Member");
csv += row("Registered Email", user.email || "");
csv += row("Location / State", location || "India");
csv += row("Account Classification", user.userType || "Standard");
csv += sep();

// Executive Movement Summary (RazorpayX Pattern)
csv += title("EXECUTIVE FINANCIAL SUMMARY");
csv += row("Total Inflow / Deposits (INR)", paiseToRupees(totalCredit));
csv += row("Total Outflow / Settlements (INR)", paiseToRupees(totalDebit));
csv += row("Net Movement for Period (INR)", paiseToRupees(totalCredit - totalDebit));
csv += sep();

// Transaction table with distinct Money In vs Money Out
csv += title("ITEMIZED TRANSACTION LEDGER");
csv += "Date & Time (IST),Transaction ID,Category,Money In (INR),Money Out (INR),Status,Description\r\n";
for (const t of txns) {
  const isCredit = ["DEPOSIT", "PAYOUT", "REFUND", "CREDIT"].includes(t.type);
  const moneyIn = isCredit ? paiseToRupees(t.amount) : "0.00";
  const moneyOut = !isCredit ? paiseToRupees(t.amount) : "0.00";
  csv += [
    format(new Date(t.createdAt), "dd/MM/yyyy HH:mm"),
    t.id || "TXN-AUTO",
    t.type,
    moneyIn,
    moneyOut,
    t.status,
    esc(t.description ?? "Escrow settlement transaction"),
  ].join(",") + "\r\n";
}
csv += sep();

// Compliance Footer (Indian IT & Tax Act)
csv += title("STATUTORY & REGULATORY COMPLIANCE");
csv += row("Service Accounting Code (SAC)", "998365 (Advertising, Promotion & Influencer Services)");
csv += row("TDS Compliance", "TDS withheld under Section 194-O / 194-J of the Income Tax Act 1961 as applicable");
csv += row("Escrow Reassurance", "Funds held in RBI-compliant escrow trust accounts prior to milestone disbursement");
csv += row("Legal Certification", "This is a computer-generated document issued by the automated ledger system and does not require a physical signature.");
csv += row("--- End of Statement ---", "");

return csv;
}

interface ParsedFilters {
type?: string | undefined;
status?: string | undefined;
startDate?: string | undefined;
endDate?: string | undefined;
}

async function handleCsvExport(
userId: string,
walletFilters: Record<string, unknown>,
parsed: ParsedFilters,
): Promise<Response> {
const user = await prisma.user.findUnique({
where: { id: userId },
select: {
email: true,
userType: true,
influencerProfile: { select: { displayName: true, city: true, state: true } },
brandProfile: { select: { companyName: true, city: true, state: true } },
},
});

if (!user) return ApiResponse.error("User not found", 404);

const isInfluencerUser = isInfluencer(user.userType);
const displayName = isInfluencerUser
? user.influencerProfile?.displayName
: user.brandProfile?.companyName;
const location = isInfluencerUser
? [user.influencerProfile?.city, user.influencerProfile?.state].filter(Boolean).join(", ")
: [user.brandProfile?.city, user.brandProfile?.state].filter(Boolean).join(", ");

const allResult = await WalletService.getWallet(userId, 1, 10000, walletFilters);
const txns = allResult.wallet?.transactions ?? [];

const filterDesc = [
parsed.type ? `Type: ${parsed.type}` : null,
parsed.status ? `Status: ${parsed.status}` : null,
parsed.startDate ? `From: ${parsed.startDate}` : null,
parsed.endDate ? `To: ${parsed.endDate}` : null,
].filter(Boolean).join(" | ") || "All Transactions";

const CREDIT_TYPES = new Set<string>(["CREDIT", "REFUND"]);
// M1 FIX: Added CLAWBACK to DEBIT_TYPES — was previously omitted, excluding clawback debits from totals
const DEBIT_TYPES = new Set<string>(["DEBIT", "WITHDRAWAL", "PLATFORM_FEE", "CLAWBACK", "CHARGEBACK"]);
// M2 FIX: Only count COMPLETED transactions in statement totals.
// Including PENDING/FAILED/REVERSED transactions corrupted exported financial summaries.
const completedTxns = txns.filter(t => t.status === "COMPLETED");
const totalCredit = completedTxns.filter(t => CREDIT_TYPES.has(t.type)).reduce((s, t) => s + t.amount, 0);
const totalDebit = completedTxns.filter(t => DEBIT_TYPES.has(t.type)).reduce((s, t) => s + t.amount, 0);

const csv = buildTransactionsCsv(user, displayName || "", location || "", txns, filterDesc, totalCredit, totalDebit);
const safeName = displayName?.replaceAll(/\s+/g, "_") ?? userId;
return csvResponse(csv, `VyaparMedia-transactions-${safeName}-${format(new Date(), "yyyy-MM-dd")}.csv`);
}

export const GET = apiWrapper(async (req: NextRequest) => {
const session = await auth();
const userId = session?.user?.id;
if (!userId) return ApiResponse.unauthorized();

const { searchParams } = req.nextUrl;
const parsed = querySchema.parse({
page: searchParams.get("page") || undefined,
limit: searchParams.get("limit") || undefined,
type: searchParams.get("type") || undefined,
status: searchParams.get("status") || undefined,
startDate: searchParams.get("startDate") || undefined,
endDate: searchParams.get("endDate") || undefined,
});

const startDate = parsed.startDate ? new Date(parsed.startDate) : undefined;
const endDate = parsed.endDate ? new Date(parsed.endDate) : undefined;
if (endDate && /^\d{4}-\d{2}-\d{2}$/.test(parsed.endDate || "")) {
endDate.setHours(23, 59, 59, 999);
}

const walletFilters = {
...(parsed.type ? { type: parsed.type } : {}),
...(parsed.status ? { status: parsed.status } : {}),
...(startDate ? { startDate } : {}),
...(endDate ? { endDate } : {}),
};

if (searchParams.get("format") === "csv") {
return handleCsvExport(userId, walletFilters, parsed);
}

const result = await WalletService.getWallet(userId, parsed.page, parsed.limit, walletFilters);

return NextResponse.json(
{
success: true,
message: "Transactions retrieved",
transactions: result.wallet?.transactions ?? [],
pagination: {
totalTransactions: result.totalTransactions,
totalPages: result.totalPages,
page: parsed.page,
limit: parsed.limit,
},
data: {
transactions: result.wallet?.transactions ?? [],
totalTransactions: result.totalTransactions,
totalPages: result.totalPages,
},
},
{ status: 200 }
);
}, { requireAuth: true });

