export interface CampaignProofItem {
  id: string;
  title: string;
  brandName: string;
  brandAvatar?: string | null | undefined;
  coverImage?: string | null | undefined;
  amountPaise: number;
  completedDate: string;
  outcomeMetric?: string | undefined; // e.g. "1.2M Views • 8.4% CTR"
  rating?: number | undefined; // 1-5
  reviewComment?: string | undefined;
  deliverables?: string[] | undefined;
  escrowVerified: boolean;
}

export interface RateCardItem {
  id: string;
  deliverable: string;
  pricePaise: number;
  turnaround: string;
  revisions: number;
  description: string;
}

export interface ReviewItem {
  id: string;
  brandName: string;
  brandAvatar?: string | null | undefined;
  rating: number; // 1-5
  comment: string;
  campaignTitle?: string | undefined;
  createdAt: string;
}

export interface InfluencerProfileData {
  id: string;
  userId: string;
  displayName: string;
  bio?: string | null | undefined;
  avatar?: string | null | undefined;
  city?: string | null | undefined;
  state?: string | null | undefined;
  categories: string[];
  languages: string[];
  instagramHandle?: string | null | undefined;
  instagramFollowers?: number | null | undefined;
  instagramEngagementRate?: number | null | undefined;
  youtubeHandle?: string | null | undefined;
  youtubeSubscribers?: number | null | undefined;
  youtubeEngagementRate?: number | null | undefined;
  completedDealsCount: number;
  trustScore: number; // 0 - 900
  responseRatePercent: number; // e.g. 98%
  avgResponseTime: string; // e.g. "< 2 hours"
  isKycVerified: boolean; // Server-side source of truth
  isSocialVerified: boolean; // Server-side source of truth
  minRatePaise: number;
  maxRatePaise?: number | null | undefined;
  campaignProofs: CampaignProofItem[];
  rateCard: RateCardItem[];
  reviews: ReviewItem[];
}
