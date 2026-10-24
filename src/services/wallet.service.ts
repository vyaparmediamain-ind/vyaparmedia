import { AppError } from "@/lib/errors";
import { TransactionStatus, TransactionType, DealStatus, Prisma, Wallet, Transaction, Withdrawal, UserType } from "@prisma/client";
import prisma from "@/lib/db";
import { logger } from "@/lib/logger";
import { ESCROW_HELD_STATUSES } from "@/lib/utils";

export interface WalletTransactionFilters {
  type?: TransactionType;
  status?: TransactionStatus;
  startDate?: Date;
  endDate?: Date;
}

export type WalletWithRelations = Wallet & {
  withdrawals: Withdrawal[];
  user: { userType: UserType };
  transactions: Transaction[];
  totalHeld: number;
};

export interface GetWalletResult {
  wallet: WalletWithRelations;
  totalTransactions: number;
  totalPages: number;
}

const WALLET_INCLUDE = {
withdrawals: {
orderBy: { createdAt: "desc" as const },
take: 5,
},
user: {
select: { userType: true },
},
} as const;

interface WalletMemoryEntry {
  data: any;
  expiresAt: number;
}
const walletMemoryCache = new Map<string, WalletMemoryEntry>();
const brandEscrowMemoryCache = new Map<string, { value: number; expiresAt: number }>();

export function invalidateWalletServiceCache(userId?: string): void {
  if (userId) {
    walletMemoryCache.delete(userId);
    brandEscrowMemoryCache.delete(userId);
  } else {
    walletMemoryCache.clear();
    brandEscrowMemoryCache.clear();
  }
}

export class WalletService {
private static async findOrCreateWallet(userId: string) {
const now = Date.now();
const cached = walletMemoryCache.get(userId);
if (cached && cached.expiresAt > now) {
  return cached.data;
}

const walletData = await prisma.wallet.findUnique({
where: { userId },
include: WALLET_INCLUDE,
});

if (walletData) {
  walletMemoryCache.set(userId, { data: walletData, expiresAt: now + 30_000 });
  return walletData;
}

logger.warn("Wallet not found for user, auto-creating", { userId });
try {
const created = await prisma.wallet.create({
data: { userId },
include: WALLET_INCLUDE,
});
walletMemoryCache.set(userId, { data: created, expiresAt: Date.now() + 30_000 });
return created;
} catch (createError) {
if (
createError instanceof Prisma.PrismaClientKnownRequestError &&
createError.code === "P2002"
) {
logger.info("Wallet creation conflict (P2002), re-querying wallet", { userId });
const wallet = await prisma.wallet.findUnique({
where: { userId },
include: WALLET_INCLUDE,
});
if (!wallet) {
throw AppError.internal("Failed to find wallet after creation conflict");
}
walletMemoryCache.set(userId, { data: wallet, expiresAt: Date.now() + 30_000 });
return wallet;
}
throw createError;
}
}

private static async findOrCreateWalletBasic(userId: string) {
const wallet = await prisma.wallet.findUnique({
where: { userId },
});

if (wallet) return wallet;

logger.warn("Wallet not found for user, auto-creating", { userId });
try {
return await prisma.wallet.create({
data: { userId },
});
} catch (createError) {
if (
createError instanceof Prisma.PrismaClientKnownRequestError &&
createError.code === "P2002"
) {
logger.info("Wallet basic creation conflict (P2002), re-querying wallet", { userId });
const wallet = await prisma.wallet.findUnique({
where: { userId },
});
if (!wallet) {
throw AppError.internal("Failed to find wallet after basic creation conflict");
}
return wallet;
}
throw createError;
}
}

private static async getBrandEscrowHeld(userId: string, userType: string): Promise<number> {
if (userType !== "BRAND") return 0;
const now = Date.now();
const cached = brandEscrowMemoryCache.get(userId);
if (cached && cached.expiresAt > now) {
  return cached.value;
}

const brandProfile = await prisma.brandProfile.findUnique({
where: { userId },
select: { id: true },
});
if (!brandProfile) return 0;

const activeDealsAggregate = await prisma.deal.aggregate({
_sum: {
totalAmount: true,
},
where: {
brandId: brandProfile.id,
status: {
in: ESCROW_HELD_STATUSES as DealStatus[],
},
},
});
const totalHeld = activeDealsAggregate._sum.totalAmount || 0;
brandEscrowMemoryCache.set(userId, { value: totalHeld, expiresAt: now + 30_000 });
return totalHeld;
}

  static async getWallet(
    userId: string,
    page: number = 1,
    limit: number = 20,
    filters?: WalletTransactionFilters,
  ): Promise<GetWalletResult> {
try {
const safePage = Math.max(1, page);
const safeLimit = Math.min(100, Math.max(1, limit));

const walletData = await this.findOrCreateWallet(userId);

const transactionWhere: Prisma.TransactionWhereInput = {
walletId: walletData.id,
};

if (filters?.type) {
transactionWhere.type = filters.type;
}

if (filters?.status) {
transactionWhere.status = filters.status;
}

if (filters?.startDate || filters?.endDate) {
transactionWhere.createdAt = {
...(filters?.startDate ? { gte: filters.startDate } : {}),
...(filters?.endDate ? { lte: filters.endDate } : {}),
};
}

const transactions = await prisma.transaction.findMany({
where: transactionWhere,
orderBy: { createdAt: "desc" },
skip: (safePage - 1) * safeLimit,
take: safeLimit,
});

let totalTransactions = transactions.length;
if (safePage > 1 || transactions.length === safeLimit) {
  totalTransactions = await prisma.transaction.count({ where: transactionWhere });
}

const totalHeld = await this.getBrandEscrowHeld(userId, walletData.user.userType);

logger.info("Wallet fetched successfully", {
userId,
transactionCount: totalTransactions,
});

return {
wallet: {
...walletData,
transactions,
totalHeld,
},
totalTransactions,
totalPages: Math.ceil(totalTransactions / safeLimit),
};
} catch (error) {
logger.error("Error fetching wallet", error, { userId });
if (error instanceof AppError) throw error;
throw AppError.internal("Failed to fetch wallet details");
}
}

static async getWalletBasic(userId: string) {
try {
return await this.findOrCreateWalletBasic(userId);
} catch (error) {
logger.error("Error fetching basic wallet", error, { userId });
if (error instanceof AppError) throw error;
throw AppError.internal("Failed to fetch wallet");
}
}
}
