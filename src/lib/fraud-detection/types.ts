export interface FraudCheckResult {
passed: boolean;
flags: FraudFlag[];
riskScore: number; // 0-100
action: "ALLOW" | "FLAG" | "BLOCK" | "REVIEW";
}

export interface FraudFlag {
rule: string;
severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
description: string;
evidence?: string;
}

export interface RegistrationCheckParams {
email: string;
phone: string;
ipAddress: string;
deviceFingerprint: string;
userAgent: string;
}

export interface ApplicationCheckParams {
userId: string;
campaignId: string;
proposalContent: string;
proposedRate?: number;
}

export interface PaymentCheckParams {
userId: string;
amount: number;
bankAccount?: string | undefined;
upiId?: string | undefined;
}

export interface GrowthCheckParams {
currentFollowers: number;
previousFollowers: number;
timeDeltaHours: number;
}

export interface FakePostTimingParams {
postTimestamp: Date; // When the post was published on the platform
submissionTimestamp: Date; // When the influencer submitted it to the platform
dealAcceptedAt: Date; // When the deal was accepted
}

export interface EngagementAnomalyParams {
followers: number;
likes: number;
comments: number;
views: number;
shares: number;
}

export interface VerifiedPostData {
isPublic: boolean;
caption: string;
isPaidPartnership: boolean;
mentions: string[];
hashtags: string[];
postTimestamp: Date;
likeCount?: number;
commentCount?: number;
viewCount?: number;
}

export interface PostVerificationParams {
dealId: string;
influencerUserId?: string; // Optional: used to fetch access tokens for deep verification
postUrl: string;
requiredTags: string[]; // Brand handles or specific words
requiredHashtags: string[];
postingDeadline: Date;
submissionTimestamp?: Date; // When the influencer submitted the post
dealAcceptedAt?: Date; // When the deal was accepted
dealAmount?: number; // Deal amount in paise kept for backward compat, no longer used as gate
followerCount?: number; // Influencer's current follower count (used in engagement anomaly check)
engagementMetrics?: {
followers: number;
likes: number;
comments: number;
views: number;
shares: number;
};
comments?: string[]; // Comments for quality analysis
}
