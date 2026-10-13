import { NextResponse } from "next/server";
import { apiWrapper } from "@/lib/api-wrapper";
import { WalletService } from "@/services/wallet.service";
import { auth } from "@/lib/auth";

export const GET = apiWrapper(async (_req) => {
const session = await auth();
const userId = session?.user?.id;
if (!userId) {
  return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
}

const result = await WalletService.getWallet(
userId,
1,
20,
);

if (!result?.wallet) {
return NextResponse.json(
{ success: false, message: "Wallet not found for user." },
{ status: 404 }
);
}

const w = result.wallet;
const walletPayload = {
id: w.id,
balance: w.balance,
pendingBalance: w.pendingBalance,
totalEarned: w.totalEarned,
totalWithdrawn: w.totalWithdrawn,
    // Use the value from the wallet object (computed by WalletService escrow calculation).
    totalHeld: w.totalHeld ?? 0,
totalSpent: w.totalSpent,
totalDeposited: w.totalDeposited,
isFrozen: w.isFrozen,
};

return NextResponse.json(
{
success: true,
message: "Wallet fetched successfully",
userType: session?.user?.userType,
wallet: walletPayload,
data: walletPayload,
},
{ status: 200 }
);
}, { requireAuth: true });
