import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  getSupabaseRealtimeClient,
  subscribeToDealUpdates,
  subscribeToWalletUpdates,
  subscribeToNotificationUpdates,
} from "@/lib/supabase-realtime";
import {
  subscribeToIncomingMessages,
  subscribeToTypingPresence,
} from "@/lib/supabase-messaging-realtime";
import { envSchema } from "@/env";
import { verifyRlsMigrations } from "@/../scripts/verify-database-rls";

describe("TP-01 & TP-09: Realtime Option A Architecture, RLS Policies & CSP Integrity", () => {
  describe("1. RLS Policy Simulation: Anon vs Authenticated vs Service Role", () => {
    // Simulated row fixtures
    const mockMessage = { id: "msg_1", senderId: "user_a", receiverId: "user_b", content: "Secret" };
    const mockNotification = { id: "notif_1", userId: "user_a", title: "Payout Processed" };
    const mockDeal = { id: "deal_1", brandUserId: "user_a", influencerUserId: "user_b", status: "VERIFIED" };
    const mockWallet = { id: "wallet_1", userId: "user_a", balance: 50000 };
    const mockTransaction = { id: "tx_1", walletUserId: "user_a", amount: 50000 };

    // Predicates modeled after PostgreSQL RLS policies in prisma/migrations
    const evaluateMessagePolicy = (row: typeof mockMessage, context: { authUid: string | null; authRole: string }) => {
      if (context.authRole === "service_role") return true;
      if (context.authUid === null) return false;
      return context.authUid === row.senderId || context.authUid === row.receiverId;
    };

    const evaluateNotificationPolicy = (row: typeof mockNotification, context: { authUid: string | null; authRole: string }) => {
      if (context.authRole === "service_role") return true;
      if (context.authUid === null) return false;
      return context.authUid === row.userId;
    };

    const evaluateDealPolicy = (row: typeof mockDeal, context: { authUid: string | null; authRole: string }) => {
      if (context.authRole === "service_role") return true;
      if (context.authUid === null) return false;
      return context.authUid === row.brandUserId || context.authUid === row.influencerUserId;
    };

    const evaluateWalletPolicy = (row: typeof mockWallet, context: { authUid: string | null; authRole: string }) => {
      if (context.authRole === "service_role") return true;
      if (context.authUid === null) return false;
      return context.authUid === row.userId;
    };

    const evaluateTransactionPolicy = (row: typeof mockTransaction, context: { authUid: string | null; authRole: string }) => {
      if (context.authRole === "service_role") return true;
      if (context.authUid === null) return false;
      return context.authUid === row.walletUserId;
    };

    it("strictly blocks anon role (auth.uid() = null) from all sensitive tables", () => {
      const anonContext = { authUid: null, authRole: "anon" };

      expect(evaluateMessagePolicy(mockMessage, anonContext)).toBe(false);
      expect(evaluateNotificationPolicy(mockNotification, anonContext)).toBe(false);
      expect(evaluateDealPolicy(mockDeal, anonContext)).toBe(false);
      expect(evaluateWalletPolicy(mockWallet, anonContext)).toBe(false);
      expect(evaluateTransactionPolicy(mockTransaction, anonContext)).toBe(false);
    });

    it("allows authenticated User A to read own rows while strictly blocking User B's rows", () => {
      const userAContext = { authUid: "user_a", authRole: "authenticated" };
      const userCContext = { authUid: "user_c", authRole: "authenticated" }; // Third party

      // User A can read their own message, notification, deal, wallet, transaction
      expect(evaluateMessagePolicy(mockMessage, userAContext)).toBe(true);
      expect(evaluateNotificationPolicy(mockNotification, userAContext)).toBe(true);
      expect(evaluateDealPolicy(mockDeal, userAContext)).toBe(true);
      expect(evaluateWalletPolicy(mockWallet, userAContext)).toBe(true);
      expect(evaluateTransactionPolicy(mockTransaction, userAContext)).toBe(true);

      // User C cannot read User A's private rows
      expect(evaluateMessagePolicy(mockMessage, userCContext)).toBe(false);
      expect(evaluateNotificationPolicy(mockNotification, userCContext)).toBe(false);
      expect(evaluateDealPolicy(mockDeal, userCContext)).toBe(false);
      expect(evaluateWalletPolicy(mockWallet, userCContext)).toBe(false);
      expect(evaluateTransactionPolicy(mockTransaction, userCContext)).toBe(false);
    });

    it("allows service_role full bypass access across all tables for Prisma server operations", () => {
      const serviceContext = { authUid: null, authRole: "service_role" };

      expect(evaluateMessagePolicy(mockMessage, serviceContext)).toBe(true);
      expect(evaluateNotificationPolicy(mockNotification, serviceContext)).toBe(true);
      expect(evaluateDealPolicy(mockDeal, serviceContext)).toBe(true);
      expect(evaluateWalletPolicy(mockWallet, serviceContext)).toBe(true);
      expect(evaluateTransactionPolicy(mockTransaction, serviceContext)).toBe(true);
    });
  });

  describe("2. RLS Migration Integrity & Revocation Verification", () => {
    it("verifies RLS coverage and anon/authenticated privilege revocation across migrations", () => {
      const result = verifyRlsMigrations();
      expect(result.success).toBe(true);
      expect(result.findings).toHaveLength(0);
      expect(result.checkedTables).toContain("Wallet");
      expect(result.checkedTables).toContain("Deal");
      expect(result.checkedTables).toContain("Message");
      expect(result.checkedTables).toContain("Notification");
      expect(result.checkedTables).toContain("Transaction");
    });
  });

  describe("3. Option A Realtime Stubs & Environment Hygiene", () => {
    it("returns null for getSupabaseRealtimeClient and clean teardown callbacks for subscribers", () => {
      expect(getSupabaseRealtimeClient()).toBeNull();

      const unsubDeal = subscribeToDealUpdates("deal_1", () => {});
      expect(typeof unsubDeal).toBe("function");
      expect(() => unsubDeal()).not.toThrow();

      const unsubWallet = subscribeToWalletUpdates("user_1", () => {});
      expect(typeof unsubWallet).toBe("function");
      expect(() => unsubWallet()).not.toThrow();

      const unsubNotif = subscribeToNotificationUpdates("user_1", () => {});
      expect(typeof unsubNotif).toBe("function");
      expect(() => unsubNotif()).not.toThrow();

      const unsubMsg = subscribeToIncomingMessages("user_1", () => {});
      expect(typeof unsubMsg).toBe("function");
      expect(() => unsubMsg()).not.toThrow();

      const typing = subscribeToTypingPresence("conv_1", () => {});
      expect(typeof typing.broadcastTyping).toBe("function");
      expect(typeof typing.unsubscribe).toBe("function");
      expect(() => typing.broadcastTyping(true)).not.toThrow();
      expect(() => typing.unsubscribe()).not.toThrow();
    });

    it("verifies NEXT_PUBLIC_SUPABASE_ANON_KEY and NEXT_PUBLIC_SUPABASE_URL are removed from envSchema", () => {
      const shape = envSchema.shape;
      expect("NEXT_PUBLIC_SUPABASE_ANON_KEY" in shape).toBe(false);
      expect("NEXT_PUBLIC_SUPABASE_URL" in shape).toBe(false);
    });
  });

  describe("4. Content Security Policy (CSP) Verification (TP-09)", () => {
    it("ensures connect-src includes essential payment & analytics hosts while excluding Supabase", () => {
      const middlewarePath = path.resolve(process.cwd(), "src/middleware.ts");
      const middlewareContent = fs.readFileSync(middlewarePath, "utf-8");

      const connectSrcMatch = middlewareContent.match(/connect-src[^;]+/);
      expect(connectSrcMatch).toBeTruthy();
      const connectSrc = connectSrcMatch![0];

      // Essential external connect-src destinations
      expect(connectSrc).toContain("checkout.razorpay.com");
      expect(connectSrc).toContain("api.razorpay.com");
      expect(connectSrc).toContain("googleapis.com");
      expect(connectSrc).toContain("sentry.io");
      expect(connectSrc).toContain("vercel-insights.com");

      // Supabase is intentionally absent under Option A (zero client-side websocket/REST calls)
      expect(connectSrc).not.toContain("supabase.co");
      expect(connectSrc).not.toContain("wss://");
    });
  });

  describe("5. Fallback Polling in UI Components", () => {
    it("verifies deal, messaging, notification, and wallet components have polling wired", () => {
      // 1. Deals: useDealRealtime.ts has 2000ms visibility-aware polling
      const dealContent = fs.readFileSync(
        path.resolve(process.cwd(), "src/components/dashboard/deals/useDealRealtime.ts"),
        "utf-8",
      );
      expect(dealContent).toContain("setInterval");
      expect(dealContent).toContain("document.visibilityState === \"visible\"");
      expect(dealContent).toContain("2000");

      // 2. Messages: useMessages.ts has 2500ms visibility-aware polling
      const messagesContent = fs.readFileSync(
        path.resolve(process.cwd(), "src/components/dashboard/messages/useMessages.ts"),
        "utf-8",
      );
      expect(messagesContent).toContain("setInterval");
      expect(messagesContent).toContain("document.visibilityState === \"visible\"");
      expect(messagesContent).toContain("2500");

      // 3. Notifications: useNotificationCenter.ts has visibilitychange, online, and 30s background interval
      const notifContent = fs.readFileSync(
        path.resolve(process.cwd(), "src/hooks/useNotificationCenter.ts"),
        "utf-8",
      );
      expect(notifContent).toContain("visibilitychange");
      expect(notifContent).toContain("30000");
      expect(notifContent).toContain("fetchNotifications");

      // 4. Wallet: useWallet.ts wraps /api/wallet with SWR revalidateOnFocus
      const walletContent = fs.readFileSync(
        path.resolve(process.cwd(), "src/hooks/api/useWallet.ts"),
        "utf-8",
      );
      expect(walletContent).toContain("useSWR");
      expect(walletContent).toContain("revalidateOnFocus: true");
    });
  });
});
