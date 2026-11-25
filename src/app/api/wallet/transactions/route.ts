import { NextResponse } from "next/server";
import { z } from "zod";
import { TransactionStatus, TransactionType } from "@prisma/client";
import { apiWrapper, ApiResponse } from "@/lib/api-wrapper";
import { WalletService } from "@/services/wallet.service";
import {
  csvResponse,
  paiseToRupees,
  buildBrandedCsv,
  buildReportFilename,
} from "@/lib/csv-export";
import { format } from "date-fns";
import prisma from "@/lib/db";
import { isInfluencer } from "@/lib/rbac";
import { assertTaxReportPrerequisites } from "@/lib/platform-config-check";
import { buildReportMeta } from "@/lib/report-meta";
import { ReportVerificationService } from "@/services/report-verification.service";

const preprocessNumeric = (val: unknown) => {
if (val === undefined || val === null || val === "") return undefined;
const num = Number(val);
return Number.isNaN(num) ? undefined : num;
};

const querySchema = z.object({
page: z.preprocess(preprocessNumeric, z.number().int().min(1).max(1000).default(1)),
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

interface CsvTxn extends Record<string, unknown> {
  id?: string;
  createdAt: Date | string;
  type: string;
  amount: number;
  status: string;
  description: string | null;
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
  // External / financial statement export checks platform corporate completeness
  assertTaxReportPrerequisites();

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
  const DEBIT_TYPES = new Set<string>([
    "DEBIT",
    "WITHDRAWAL",
    "PLATFORM_FEE",
    "CLAWBACK",
    "CHARGEBACK",
    "SHIPPING_CHARGE",
  ]);
  const completedTxns = txns.filter((t) => t.status === "COMPLETED");
  const totalCredit = completedTxns
    .filter((t) => CREDIT_TYPES.has(t.type))
    .reduce((s, t) => s + t.amount, 0);
  const totalDebit = completedTxns
    .filter((t) => DEBIT_TYPES.has(t.type))
    .reduce((s, t) => s + t.amount, 0);

  const reportMeta = buildReportMeta({
    type: "STATEMENT",
    scope: displayName || "Wallet Statement",
    period: filterDesc,
    user: {
      id: userId,
      name: displayName || "Platform Member",
      email: user.email,
      role: user.userType,
    },
    dataQualitySummary: {
      verifiedPercent: 100,
      estimatedPercent: 0,
      selfReportedPercent: 0,
    },
    payload: {
      userId,
      totalCredit,
      totalDebit,
      txns: txns.map((t) => ({ id: t.id, type: t.type, amount: t.amount })),
    },
  });

  // Audit log
  await prisma.activityLog.create({
    data: {
      userId,
      action: "REPORT_EXPORT",
      entityType: "Wallet",
      entityId: userId,
      metadata: {
        type: "STATEMENT",
        format: "csv",
        reportId: reportMeta.reportId,
      },
    },
  }).catch(() => {});

  // Cryptographic report verification registration
  await ReportVerificationService.recordReport({
    id: reportMeta.reportId,
    type: "STATEMENT",
    userId,
    scopeId: userId,
    payloadHash: reportMeta.integrityCode,
  });

  const columns = [
    {
      key: "date",
      label: "Date & Time (IST)",
      format: (_v: unknown, row: CsvTxn) => format(new Date(row.createdAt), "dd/MM/yyyy HH:mm"),
    },
    { key: "id", label: "Transaction ID", format: (v: unknown) => String(v || "TXN-AUTO") },
    { key: "type", label: "Category" },
    {
      key: "moneyIn",
      label: "Money In (INR)",
      format: (_v: unknown, row: CsvTxn) =>
        ["CREDIT", "REFUND"].includes(row.type) ? paiseToRupees(row.amount) : "0.00",
    },
    {
      key: "moneyOut",
      label: "Money Out (INR)",
      format: (_v: unknown, row: CsvTxn) =>
        !["CREDIT", "REFUND"].includes(row.type) ? paiseToRupees(row.amount) : "0.00",
    },
    { key: "status", label: "Status" },
    {
      key: "description",
      label: "Description",
      format: (v: unknown) => String(v ?? "Escrow settlement transaction"),
    },
  ];

  const customSections = [
    {
      title: "STATEMENT PARAMETERS",
      rows: [
        ["Document Type", "Escrow & Wallet Ledger Statement"],
        ["Scope / Filter", filterDesc],
        ["Total Records", String(txns.length)],
        ["Base Currency", "INR (Indian Rupee)"],
      ] as Array<[string, string | number]>,
    },
    {
      title: "ACCOUNT HOLDER DOSSIER",
      rows: [
        ["Account Name", displayName || "Verified Platform Member"],
        ["Registered Email", user.email || ""],
        ["Location / State", location || "India"],
        ["Account Classification", user.userType || "Standard"],
      ] as Array<[string, string | number]>,
    },
    {
      title: "EXECUTIVE FINANCIAL SUMMARY",
      rows: [
        ["Total Inflow / Deposits (INR)", paiseToRupees(totalCredit)],
        ["Total Outflow / Settlements (INR)", paiseToRupees(totalDebit)],
        ["Net Movement for Period (INR)", paiseToRupees(totalCredit - totalDebit)],
      ] as Array<[string, string | number]>,
    },
    {
      title: "STATUTORY & REGULATORY COMPLIANCE",
      rows: [
        ["Service Accounting Code (SAC)", "998365 (Advertising, Marketing & Influencer Services)"],
        [
          "TDS Compliance",
          "TDS withheld under Section 194-O / 194-J of the Income Tax Act 1961 as applicable",
        ],
        [
          "Escrow Reassurance",
          "Funds held in RBI-compliant escrow trust accounts prior to milestone disbursement",
        ],
        [
          "Legal Certification",
          "This is a computer-generated document issued by the automated ledger system and does not require a physical signature.",
        ],
      ] as Array<[string, string | number]>,
    },
  ];

  const csv = buildBrandedCsv<CsvTxn>({
    meta: reportMeta,
    columns,
    rows: txns,
    customSections,
  });

  const filename = buildReportFilename("Statement", displayName || "Account");
  return csvResponse(csv, filename);
}

export const GET = apiWrapper(async (req) => {
  const session = req.session;
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
transactions: result?.wallet?.transactions ?? [],
pagination: {
totalTransactions: result?.totalTransactions ?? 0,
totalPages: result?.totalPages ?? 0,
page: parsed.page,
limit: parsed.limit,
},
data: {
transactions: result?.wallet?.transactions ?? [],
totalTransactions: result?.totalTransactions ?? 0,
totalPages: result?.totalPages ?? 0,
},
},
{ status: 200 }
);
}, {
  requireAuth: true,
  userRateLimit: { bucket: "REPORTS" },
});

