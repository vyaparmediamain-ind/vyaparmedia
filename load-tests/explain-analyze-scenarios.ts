import "./mock-server-only";
import prisma from "../src/lib/db";

interface ExplainPlanNode {
  "Node Type": string;
  "Index Name"?: string;
  "Relation Name"?: string;
  Plans?: ExplainPlanNode[];
  "Actual Total Time"?: number;
  "Actual Rows"?: number;
  "Total Cost"?: number;
}

interface ExplainResult {
  Plan: ExplainPlanNode;
  "Planning Time"?: number;
  "Execution Time"?: number;
}

function findScans(node: ExplainPlanNode): {
  nodeType: string;
  indexName?: string | undefined;
  relationName?: string | undefined;
  actualTime?: number | undefined;
}[] {
  const results: {
    nodeType: string;
    indexName?: string | undefined;
    relationName?: string | undefined;
    actualTime?: number | undefined;
  }[] = [];

  if (node["Node Type"].includes("Scan") || node["Node Type"].includes("Sort")) {
    results.push({
      nodeType: node["Node Type"],
      indexName: node["Index Name"],
      relationName: node["Relation Name"],
      actualTime: node["Actual Total Time"],
    });
  }

  if (node.Plans && Array.isArray(node.Plans)) {
    for (const subPlan of node.Plans) {
      results.push(...findScans(subPlan));
    }
  }
  return results;
}

export interface ScenarioBenchmarkResult {
  scenario: string;
  sql: string;
  planningTimeMs: number;
  executionTimeMs: number;
  scans: { nodeType: string; indexName?: string | undefined; relationName?: string | undefined }[];
  indexUsed: string;
  bottleneck: string;
  suggestion?: string;
}

export async function runExplainAnalyzeScenarios(): Promise<ScenarioBenchmarkResult[]> {
  console.log("================================================================================");
  console.log("  VYAPARMEDIA READ-HEAVY SCENARIOS: EXPLAIN (ANALYZE, BUFFERS) AUDIT");
  console.log("================================================================================\n");

  const results: ScenarioBenchmarkResult[] = [];

  // Scenarios mapped to the 4 critical read-heavy paths
  const scenarios = [
    {
      scenario: "1. Creator Discovery & Search (Keyset Cursor by followers DESC, id DESC)",
      sql: `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
        SELECT ip.id, ip."displayName", ip."instagramFollowers", ip."averageRating", u."trustScore"
        FROM "InfluencerProfile" ip
        JOIN "User" u ON ip."userId" = u.id
        WHERE ip."deletedAt" IS NULL
          AND ((ip."instagramFollowers" < 100000) OR (ip."instagramFollowers" = 100000 AND ip.id < 'cmtz000000000infl000000001'))
        ORDER BY ip."instagramFollowers" DESC, ip.id DESC
        LIMIT 21;`,
      suggestion:
        "CREATE INDEX CONCURRENTLY idx_influencer_cursor_followers ON \"InfluencerProfile\" (\"deletedAt\", \"instagramFollowers\" DESC, id DESC); -> Enables pure Index Only Scan for keyset pagination without in-memory sort.",
    },
    {
      scenario: "2. Campaign List & Marketplace Feed (Active campaigns ordered by createdAt DESC)",
      sql: `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
        SELECT c.id, c.title, c."totalBudget", c.status, c."createdAt", bp."companyName"
        FROM "Campaign" c
        LEFT JOIN "BrandProfile" bp ON c."brandId" = bp.id
        WHERE c.status = 'ACTIVE' AND c."deletedAt" IS NULL
        ORDER BY c."createdAt" DESC
        LIMIT 20;`,
      suggestion:
        "Index @@index([status, deletedAt, createdAt(sort: Desc)]) is already leveraged. Ensure BrandProfile.id primary key join stays hot in buffer cache.",
    },
    {
      scenario: "3. Wallet Ledger & Transaction Feed (Recent transactions for user wallet)",
      sql: `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
        SELECT t.id, t.type, t.amount, t.status, t."createdAt", t.description
        FROM "Transaction" t
        WHERE t."walletId" = 'seed-wallet-brand-id' AND t."deletedAt" IS NULL
        ORDER BY t."createdAt" DESC
        LIMIT 20;`,
      suggestion:
        "Ensure composite index ON \"Transaction\" (\"walletId\", \"deletedAt\", \"createdAt\" DESC) is maintained so ledger scan never scans uncommitted or deleted rows.",
    },
    {
      scenario: "4. Influencer Deal List Feed (Active deals ordered by createdAt DESC)",
      sql: `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
        SELECT d.id, d.status, d.amount, d."totalAmount", d."createdAt", d."submissionDeadline"
        FROM "Deal" d
        WHERE d."influencerId" = 'seed-influencer-id' AND d.status = 'ACTIVE' AND d."deletedAt" IS NULL
        ORDER BY d."createdAt" DESC
        LIMIT 20;`,
      suggestion:
        "CREATE INDEX CONCURRENTLY idx_deal_influencer_status_created ON \"Deal\" (\"influencerId\", \"status\", \"deletedAt\", \"createdAt\" DESC); -> Prevents memory Sort node for influencer dashboard deals list.",
    },
  ];

  for (const s of scenarios) {
    console.log(`▶ Executing: ${s.scenario}`);
    try {
      const raw = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(s.sql);
      const firstRow = raw[0] || {};
      const planData: ExplainResult = Array.isArray(firstRow)
        ? (firstRow[0] as ExplainResult)
        : ((firstRow["QUERY PLAN"] as ExplainResult[])?.[0] || (firstRow as unknown as ExplainResult));

      const plan = planData.Plan || (planData as unknown as { Plan: ExplainPlanNode })?.Plan;
      const scans = findScans(plan);
      const executionTime = planData["Execution Time"] ?? 0;
      const planningTime = planData["Planning Time"] ?? 0;
      const indexUsed = scans.map((sc) => sc.indexName).filter(Boolean).join(", ") || "Seq Scan / Primary Key Scan";

      let bottleneck = "None (optimal plan)";
      if (scans.some((sc) => sc.nodeType.includes("Sort"))) {
        bottleneck = "In-memory Sort node detected (Index does not cover full ORDER BY direction)";
      } else if (scans.some((sc) => sc.nodeType === "Seq Scan")) {
        bottleneck = "Seq Scan detected (Optimizer preferred table scan or index missing)";
      }

      console.log(`  ⏱️ Planning: ${planningTime.toFixed(2)}ms | Execution: ${executionTime.toFixed(2)}ms`);
      console.log(`  🔍 Scan Type(s): ${scans.map((sc) => sc.nodeType).join(" -> ")}`);
      console.log(`  📌 Index: ${indexUsed}`);
      console.log(`  ⚠️ Bottleneck Analysis: ${bottleneck}`);
      console.log(`  💡 Suggestion: ${s.suggestion}\n`);

      results.push({
        scenario: s.scenario,
        sql: s.sql,
        planningTimeMs: Number(planningTime.toFixed(2)),
        executionTimeMs: Number(executionTime.toFixed(2)),
        scans,
        indexUsed,
        bottleneck,
        suggestion: s.suggestion,
      });
    } catch (err: unknown) {
      console.error(`  ❌ Error executing query:`, err instanceof Error ? err.message : String(err));
    }
  }

  return results;
}

if (process.argv[1]?.includes("explain-analyze-scenarios")) {
  runExplainAnalyzeScenarios()
    .then(() => prisma.$disconnect())
    .catch((err) => {
      console.error(err);
      prisma.$disconnect();
      process.exit(1);
    });
}

