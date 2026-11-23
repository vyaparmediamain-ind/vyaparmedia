import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { verifyRlsMigrations, SENSITIVE_TABLES } from "@/../scripts/verify-database-rls";
import { Prisma } from "@prisma/client";

describe("Fair Pricing Schema & Tunables Architecture (P00/P11 REL-08)", () => {
  const schemaPath = path.join(process.cwd(), "prisma", "schema.prisma");
  const schemaContent = fs.readFileSync(schemaPath, "utf-8");

  describe("1. InfluencerProfile Fair Pricing Fields", () => {
    it("defines all required nullable fair rate fields on InfluencerProfile", () => {
      expect(schemaContent).toContain("fairRateMinPaise        Int?");
      expect(schemaContent).toContain("fairRateMaxPaise        Int?");
      expect(schemaContent).toContain("fairRateConfidence      String?");
      expect(schemaContent).toContain("fairRateDataQuality     String?");
      expect(schemaContent).toContain("fairRateComputedAt      DateTime?");
      expect(schemaContent).toContain("fairRateEngineVersion   String?");
    });

    it("wires relation to PricingEvaluation model on InfluencerProfile and User", () => {
      expect(schemaContent).toMatch(/model InfluencerProfile[\s\S]*?pricingEvaluations\s+PricingEvaluation\[\]/);
      expect(schemaContent).toMatch(/model User[\s\S]*?pricingEvaluations\s+PricingEvaluation\[\]/);
    });
  });

  describe("2. PricingEvaluation Model Structure & Indexes", () => {
    it("defines PricingEvaluation model with all requested columns and relations", () => {
      expect(schemaContent).toContain("model PricingEvaluation {");
      expect(schemaContent).toContain("inputsHash        String");
      expect(schemaContent).toContain("inputsJson        Json");
      expect(schemaContent).toContain("outputJson        Json");
      expect(schemaContent).toContain("engineVersion     String");
      expect(schemaContent).toContain("configVersion     Int");
      expect(schemaContent).toContain("createdAt         DateTime          @default(now())");
    });

    it("defines performance indexes on (influencerId, createdAt desc) and inputsHash", () => {
      expect(schemaContent).toContain("@@index([influencerId, createdAt(sort: Desc)])");
      expect(schemaContent).toContain("@@index([inputsHash])");
    });

    it("supports Prisma Client typed operations for PricingEvaluation", () => {
      // Type assertion compile check for Prisma.PricingEvaluationCreateInput
      const mockCreateInput: Prisma.PricingEvaluationCreateInput = {
        influencer: { connect: { id: "inf_mock_1" } },
        platform: "INSTAGRAM",
        contentType: "REEL",
        inputsHash: "hash_abcdef123456",
        inputsJson: { followers: 50000, erBps: 320, category: "tech" },
        outputJson: { fairRateMinPaise: 450000, fairRateMaxPaise: 650000, confidence: "HIGH" },
        engineVersion: "v3.0.0",
        configVersion: 1,
      };

      expect(mockCreateInput.platform).toBe("INSTAGRAM");
      expect(mockCreateInput.configVersion).toBe(1);
    });
  });

  describe("3. Tunables Storage Pattern & PricingConfig Model", () => {
    it("defines versioned PricingConfig model for structured JSON matrices", () => {
      expect(schemaContent).toContain("model PricingConfig {");
      expect(schemaContent).toContain("version     Int      @unique");
      expect(schemaContent).toContain("isActive    Boolean  @default(true)");
      expect(schemaContent).toContain("configJson  Json");
      expect(schemaContent).toContain("@@index([isActive])");
    });

    it("preserves TrustRuleConfig pattern compatibility for live scalar tunables", () => {
      // In TrustRuleConfig, CPV baselines and scalar tunables use category / ruleKey / weight
      const mockTrustRuleInput: Prisma.TrustRuleConfigCreateInput = {
        ruleKey: "CPV_BENCHMARK_FINANCE",
        category: "BENCHMARK_CPV",
        weight: 120, // 120 paise = ₹1.20
        description: "Admin configured baseline CPV for finance",
        isActive: true,
      };

      expect(mockTrustRuleInput.category).toBe("BENCHMARK_CPV");
      expect(mockTrustRuleInput.weight).toBe(120);
    });
  });

  describe("4. RLS Defense-in-Depth Verification", () => {
    it("registers PricingEvaluation and PricingConfig in SENSITIVE_TABLES", () => {
      expect(SENSITIVE_TABLES).toContain("PricingEvaluation");
      expect(SENSITIVE_TABLES).toContain("PricingConfig");
    });

    it("verifies RLS policies and revoked PostgREST permissions in migration script", () => {
      const result = verifyRlsMigrations();
      expect(result.success).toBe(true);
      expect(result.findings).toHaveLength(0);
      expect(result.checkedTables).toContain("PricingEvaluation");
      expect(result.checkedTables).toContain("PricingConfig");
    });
  });
});
