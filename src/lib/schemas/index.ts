/**
 * Central barrel file for all shared Zod schemas and inferred TypeScript types.
 * Both frontend and backend must import schemas and types from here.
 */

// Common
export * from "./common.schema";

// Campaign
export * from "./campaign.schema";

// Creator & Influencer
export * from "./creator.schema";

// Bookmarks
export * from "./bookmark.schema";

// Wallet & Transactions
export * from "./wallet.schema";

// Deals & Escrow Stories
export * from "./deal.schema";

// Applications
export * from "./application.schema";

// Disputes
export * from "./dispute.schema";

// Settings & Notifications
export * from "./settings.schema";

// Gamification (Badges, Challenges, Referrals)
export * from "./gamification.schema";
