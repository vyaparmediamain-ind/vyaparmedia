import prisma from "@/lib/db";
import { calculateLevel, getPlatformFeePercentage } from "@/lib/drs-score";
import { getEffectivePlatformFee } from "@/lib/referral-engine";

export interface PlatformFeeSnapshot {
userLevel: number;
levelBasedFee: number;
referralTier: string;
referralFee: number;
effectivePlatformFee: number;
}

export async function resolveBrandPlatformFee(
brandUserId: string,
): Promise<PlatformFeeSnapshot> {
const brandUser = await prisma.user.findUnique({
where: { id: brandUserId },
select: { xp: true },
});

const userLevel = brandUser ? calculateLevel(brandUser.xp).level : 1;
const levelBasedFee = getPlatformFeePercentage(userLevel);
const referralFeeInfo = await getEffectivePlatformFee(brandUserId);
const effectivePlatformFee = Math.max(
  0,
  Math.min(levelBasedFee, referralFeeInfo.effectiveFee),
);

return {
userLevel,
levelBasedFee,
referralTier: referralFeeInfo.tier,
referralFee: referralFeeInfo.effectiveFee,
effectivePlatformFee,
};
}
