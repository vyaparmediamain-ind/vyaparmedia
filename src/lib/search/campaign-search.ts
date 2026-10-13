import { getReadClient } from "../db-read";
import { logger } from "../logger";
import {
  CampaignSearchParams,
  CursorPaginationResult,
} from "./types";
import { encodeCursor, decodeCursor } from "./cursor";
import { getCachedSearchResults, setCachedSearchResults } from "./cache";

export interface CampaignSearchResultItem {
  id: string;
  brandId: string | null;
  influencerId: string | null;
  title: string;
  description: string;
  requirements: string;
  guidelines: string | null;
  targetCategories: string[];
  targetCities: string[];
  targetLanguages: string[];
  targetGender: string | null;
  minAge: number | null;
  maxAge: number | null;
  totalBudget: number;
  perInfluencerBudget: number | null;
  minFollowers: number;
  maxFollowers: number | null;
  minEngagementRate: number | null;
  deliverables: unknown;
  requiresProduct: boolean;
  productName: string | null;
  productValue: number | null;
  productDescription: string | null;
  applicationDeadline: Date | null;
  contentDeadline: Date;
  postingDeadline: Date;
  status: string;
  isDirectInvite: boolean;
  totalApplications: number;
  selectedInfluencers: number;
  maxInfluencers: number | null;
  createdAt: Date;
  updatedAt: Date;
  brand?: {
    id: string;
    companyName: string;
    logo: string | null;
    industry: string | null;
  } | undefined;
  rankScore?: number | undefined;
}

interface RawCampaignRow extends Omit<CampaignSearchResultItem, "brand" | "rankScore"> {
  brandProfileId?: string | null;
  brandCompanyName?: string | null;
  brandLogo?: string | null;
  brandIndustry?: string | null;
  rankScore?: number | null;
}

export async function searchCampaigns(
  params: CampaignSearchParams,
): Promise<CursorPaginationResult<CampaignSearchResultItem>> {
  const start = Date.now();
  const limit = Math.max(1, Math.min(params.limit || 20, 100));

  // 1. Check Redis Cache
  const cached = await getCachedSearchResults<CursorPaginationResult<CampaignSearchResultItem>>(
    "campaigns",
    params,
  );
  if (cached) {
    return { ...cached, durationMs: Date.now() - start };
  }

  const client = getReadClient();
  const cursor = decodeCursor(params.cursor);

  const values: (string | number | boolean)[] = [];
  let paramIdx = 1;

  const whereClauses: string[] = ['c."deletedAt" IS NULL'];

  // Status Filter
  const status = params.status || "ACTIVE";
  if (status !== "ALL") {
    values.push(status);
    whereClauses.push(`c.status = $${paramIdx}::"CampaignStatus"`);
    paramIdx++;

    if (status === "ACTIVE") {
      whereClauses.push('(c."applicationDeadline" IS NULL OR c."applicationDeadline" >= NOW())');
    }
  }

  // Full-Text Search and Trigram Fuzzy Matching
  const rawSearch = params.search?.trim();
  if (rawSearch) {
    const searchParamIdx = paramIdx;
    values.push(rawSearch);
    paramIdx++;

    whereClauses.push(`
      (
        to_tsvector('english', coalesce(c.title, '') || ' ' || coalesce(c.description, '')) @@ plainto_tsquery('english', $${searchParamIdx})
        OR similarity(c.title, $${searchParamIdx}) > 0.2
      )
    `);
  }

  // Category Filter (Array Check)
  if (params.category?.trim()) {
    values.push(params.category.trim());
    whereClauses.push(`$${paramIdx} = ANY(c."targetCategories")`);
    paramIdx++;
  }

  // City Filter (Array Check)
  if (params.city?.trim()) {
    values.push(params.city.trim());
    whereClauses.push(`$${paramIdx} = ANY(c."targetCities")`);
    paramIdx++;
  }

  // Budget Filter (Indexed)
  if (typeof params.minBudget === "number" && !Number.isNaN(params.minBudget)) {
    values.push(params.minBudget);
    whereClauses.push(`c."perInfluencerBudget" >= $${paramIdx}`);
    paramIdx++;
  }
  if (typeof params.maxBudget === "number" && !Number.isNaN(params.maxBudget)) {
    values.push(params.maxBudget);
    whereClauses.push(`c."perInfluencerBudget" <= $${paramIdx}`);
    paramIdx++;
  }

  // Brand Owner Filter
  if (params.ownerOnly && params.userId) {
    values.push(params.userId);
    whereClauses.push(`bp."userId" = $${paramIdx}`);
    paramIdx++;
  }

  // Sorting
  const sortBy = params.sortBy || "createdAt";
  const sortOrder = params.sortOrder || "desc";

  let sortColumnSql = "";
  let selectRankSql = "";

  if (sortBy === "relevance" && rawSearch) {
    selectRankSql = `, (COALESCE(ts_rank_cd(to_tsvector('english', coalesce(c.title, '') || ' ' || coalesce(c.description, '')), plainto_tsquery('english', $2)), 0) * 0.7 + COALESCE(similarity(c.title, $2), 0) * 0.3) AS "rankScore"`;
    sortColumnSql = `"rankScore"`;
  } else if (sortBy === "budget") {
    sortColumnSql = `COALESCE(c."perInfluencerBudget", 0)`;
  } else {
    sortColumnSql = `c."createdAt"`;
  }

  // Keyset Cursor Condition
  if (cursor) {
    const op = sortOrder === "asc" ? ">" : "<";
    const sortValIdx = paramIdx;
    values.push(cursor.sortValue);
    paramIdx++;

    const idIdx = paramIdx;
    values.push(cursor.id);
    paramIdx++;

    if (sortBy === "createdAt" || sortBy === "recency") {
      whereClauses.push(`
        ((c."createdAt" ${op} $${sortValIdx}::timestamptz) OR (c."createdAt" = $${sortValIdx}::timestamptz AND c.id ${op} $${idIdx}))
      `);
    } else {
      whereClauses.push(`
        ((${sortColumnSql} ${op} $${sortValIdx}::numeric) OR (${sortColumnSql} = $${sortValIdx}::numeric AND c.id ${op} $${idIdx}))
      `);
    }
  }

  // Backward-compatible offset fallback
  let offsetClause = "";
  if (!cursor && params.page && params.page > 1) {
    const skip = (params.page - 1) * limit;
    offsetClause = `OFFSET ${skip}`;
  }

  const queryLimit = limit + 1;
  const limitIdx = paramIdx;
  values.push(queryLimit);
  paramIdx++;

    const safeSortDir = String(sortOrder).toLowerCase() === "asc" ? "ASC" : "DESC";
    const sql = `
    SELECT 
      c.*,
      bp.id AS "brandProfileId",
      bp."companyName" AS "brandCompanyName",
      bp.logo AS "brandLogo",
      bp.industry AS "brandIndustry"
      ${selectRankSql}
    FROM "Campaign" c
    LEFT JOIN "BrandProfile" bp ON c."brandId" = bp.id
    WHERE ${whereClauses.join(" AND ")}
    ORDER BY ${sortColumnSql} ${safeSortDir}, c.id ${safeSortDir}
    LIMIT $${limitIdx}
    ${offsetClause}
  `;

  try {
    const rawRows = await client.$queryRawUnsafe<RawCampaignRow[]>(sql, ...values);

    const hasMore = rawRows.length > limit;
    const resultRows = hasMore ? rawRows.slice(0, limit) : rawRows;

    let nextCursor: string | null = null;
    const lastItem = hasMore && resultRows.length > 0 ? resultRows[resultRows.length - 1] : undefined;
    if (lastItem) {
      let sortVal: string | number = "";
      if (sortBy === "budget") sortVal = Number(lastItem.perInfluencerBudget || 0);
      else if (sortBy === "relevance" && rawSearch) sortVal = Number(lastItem.rankScore || 0);
      else sortVal = new Date(lastItem.createdAt).toISOString();

      nextCursor = encodeCursor({
        id: lastItem.id,
        sortValue: sortVal,
      });
    }

    const items: CampaignSearchResultItem[] = resultRows.map((r) => ({
      id: r.id,
      brandId: r.brandId,
      influencerId: r.influencerId,
      title: r.title,
      description: r.description,
      requirements: r.requirements,
      guidelines: r.guidelines,
      targetCategories: r.targetCategories || [],
      targetCities: r.targetCities || [],
      targetLanguages: r.targetLanguages || [],
      targetGender: r.targetGender,
      minAge: r.minAge,
      maxAge: r.maxAge,
      totalBudget: r.totalBudget,
      perInfluencerBudget: r.perInfluencerBudget,
      minFollowers: r.minFollowers,
      maxFollowers: r.maxFollowers,
      minEngagementRate: r.minEngagementRate,
      deliverables: r.deliverables,
      requiresProduct: r.requiresProduct,
      productName: r.productName,
      productValue: r.productValue,
      productDescription: r.productDescription,
      applicationDeadline: r.applicationDeadline,
      contentDeadline: r.contentDeadline,
      postingDeadline: r.postingDeadline,
      status: r.status,
      isDirectInvite: r.isDirectInvite,
      totalApplications: r.totalApplications,
      selectedInfluencers: r.selectedInfluencers,
      maxInfluencers: r.maxInfluencers,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      rankScore: r.rankScore ? Number(r.rankScore) : undefined,
      brand: r.brandProfileId
        ? {
            id: r.brandProfileId,
            companyName: r.brandCompanyName || "",
            logo: r.brandLogo ?? null,
            industry: r.brandIndustry ?? null,
          }
        : undefined,
    }));

    const result: CursorPaginationResult<CampaignSearchResultItem> = {
      items,
      nextCursor,
      hasMore,
      durationMs: Date.now() - start,
    };

    // Cache results in Redis
    await setCachedSearchResults("campaigns", params, result);

    return result;
  } catch (error) {
    logger.error("Error executing campaign search query", { error, params });
    throw error;
  }
}
