import { getReadClient } from "../db-read";
import { logger } from "../logger";
import {
  CreatorSearchParams,
  CursorPaginationResult,
} from "./types";
import { encodeCursor, decodeCursor } from "./cursor";
import { buildCreatorSqlRankingExpression } from "./ranking";
import { getCachedSearchResults, setCachedSearchResults } from "./cache";

export interface CreatorSearchResultItem {
  id: string;
  userId: string;
  displayName: string;
  bio: string | null;
  avatar: string | null;
  city: string | null;
  state: string | null;
  instagramHandle: string | null;
  instagramFollowers: number | null;
  instagramEngagementRate: number | null;
  youtubeHandle: string | null;
  youtubeSubscribers: number | null;
  youtubeEngagementRate: number | null;
  categories: string;
  languages: string;
  minRate: number | null;
  maxRate: number | null;
  minInstagramRate: number | null;
  maxInstagramRate: number | null;
  minYoutubeRate: number | null;
  maxYoutubeRate: number | null;
  followerAuthenticityScore: number;
  contentQualityScore: number;
  isFeatured: boolean;
  featuredUntil: Date | null;
  totalDeals: number;
  completedDeals: number;
  averageRating: number;
  totalReviews: number;
  createdAt: Date;
  updatedAt: Date;
  rankScore?: number | undefined;
  user: {
    trustScore: number;
    level: number;
    xp: number;
  };
}

interface RawCreatorRow {
  id: string;
  userId: string;
  displayName: string;
  bio: string | null;
  avatar: string | null;
  city: string | null;
  state: string | null;
  instagramHandle: string | null;
  instagramFollowers: number | null;
  instagramEngagementRate: number | null;
  youtubeHandle: string | null;
  youtubeSubscribers: number | null;
  youtubeEngagementRate: number | null;
  categories: string;
  languages: string;
  minRate: number | null;
  maxRate: number | null;
  minInstagramRate: number | null;
  maxInstagramRate: number | null;
  minYoutubeRate: number | null;
  maxYoutubeRate: number | null;
  followerAuthenticityScore: number;
  contentQualityScore: number;
  isFeatured: boolean;
  featuredUntil: Date | null;
  totalDeals: number;
  completedDeals: number;
  averageRating: number;
  totalReviews: number;
  createdAt: Date;
  updatedAt: Date;
  userTrustScore: number;
  userLevel: number;
  userXp: number;
  rankScore?: number | null;
}

export async function searchCreators(
  params: CreatorSearchParams,
): Promise<CursorPaginationResult<CreatorSearchResultItem>> {
  const start = Date.now();
  const limit = Math.max(1, Math.min(params.limit || 20, 100));

  // 1. Check Redis Cache
  const cached = await getCachedSearchResults<CursorPaginationResult<CreatorSearchResultItem>>(
    "creators",
    params,
  );
  if (cached) {
    return { ...cached, durationMs: Date.now() - start };
  }

  const client = getReadClient();
  const cursor = decodeCursor(params.cursor);

  // Parameter bindings
  const values: (string | number | boolean)[] = [];
  let paramIdx = 1;

  const whereClauses: string[] = ["1=1"];

  // Full-Text Search and Trigram Fuzzy Matching
  const rawSearch = params.searchTerm?.trim();
  let searchParamIndex = 0;
  if (rawSearch) {
    searchParamIndex = paramIdx;
    values.push(rawSearch);
    paramIdx++;

    whereClauses.push(`
      (
        to_tsvector('english', coalesce(ip."displayName", '') || ' ' || coalesce(ip.bio, '') || ' ' || coalesce(ip.categories, '') || ' ' || coalesce(ip.city, '')) @@ plainto_tsquery('english', $${searchParamIndex})
        OR similarity(ip."displayName", $${searchParamIndex}) > 0.2
      )
    `);
  }

  // Niche / Category Filter (Indexed)
  if (params.category?.trim()) {
    values.push(`%${params.category.trim()}%`);
    whereClauses.push(`ip.categories ILIKE $${paramIdx}`);
    paramIdx++;
  }

  // Location / City Filter (Indexed)
  if (params.city?.trim()) {
    values.push(`%${params.city.trim()}%`);
    whereClauses.push(`ip.city ILIKE $${paramIdx}`);
    paramIdx++;
  }

  // Followers Range (Indexed)
  if (typeof params.minFollowers === "number" && !Number.isNaN(params.minFollowers)) {
    values.push(params.minFollowers);
    whereClauses.push(`ip."instagramFollowers" >= $${paramIdx}`);
    paramIdx++;
  }
  if (typeof params.maxFollowers === "number" && !Number.isNaN(params.maxFollowers)) {
    values.push(params.maxFollowers);
    whereClauses.push(`ip."instagramFollowers" <= $${paramIdx}`);
    paramIdx++;
  }

  // Engagement Rate
  if (typeof params.minEngagementRate === "number" && !Number.isNaN(params.minEngagementRate)) {
    values.push(params.minEngagementRate);
    whereClauses.push(`ip."instagramEngagementRate" >= $${paramIdx}`);
    paramIdx++;
  }

  // Rates Range (Indexed)
  if (typeof params.minRate === "number" && !Number.isNaN(params.minRate)) {
    values.push(params.minRate);
    whereClauses.push(`ip."minRate" >= $${paramIdx}`);
    paramIdx++;
  }
  if (typeof params.maxRate === "number" && !Number.isNaN(params.maxRate)) {
    values.push(params.maxRate);
    whereClauses.push(`ip."maxRate" <= $${paramIdx}`);
    paramIdx++;
  }

  // Social Platform
  if (params.platform === "instagram") {
    whereClauses.push(`ip."instagramHandle" IS NOT NULL AND ip."instagramHandle" != ''`);
  } else if (params.platform === "youtube") {
    whereClauses.push(`ip."youtubeHandle" IS NOT NULL AND ip."youtubeHandle" != ''`);
  }

  // Featured Filter
  if (typeof params.isFeatured === "boolean") {
    values.push(params.isFeatured);
    whereClauses.push(`ip."isFeatured" = $${paramIdx}`);
    paramIdx++;
  }

  // Determine Order By & Cursor Column
  const sortBy = params.sortBy || "relevance";
  const sortOrder = params.sortOrder || (sortBy === "rate" ? "asc" : "desc");

  let sortColumnSql = "";
  let selectRankSql = "";

  if (sortBy === "relevance") {
    selectRankSql = `, ${buildCreatorSqlRankingExpression(Boolean(rawSearch))} AS "rankScore"`;
    sortColumnSql = `"rankScore"`;
  } else if (sortBy === "followers") {
    sortColumnSql = `COALESCE(ip."instagramFollowers", 0)`;
  } else if (sortBy === "rating") {
    sortColumnSql = `COALESCE(ip."averageRating", 0)`;
  } else if (sortBy === "rate") {
    sortColumnSql = `COALESCE(ip."minRate", 0)`;
  } else {
    sortColumnSql = `ip."createdAt"`;
  }

  // Handle Keyset Cursor Condition
  if (cursor) {
    const op = sortOrder === "asc" ? ">" : "<";
    const sortValIdx = paramIdx;
    values.push(cursor.sortValue);
    paramIdx++;

    const idIdx = paramIdx;
    values.push(cursor.id);
    paramIdx++;

    if (sortBy === "recency") {
      whereClauses.push(`
        ((ip."createdAt" ${op} $${sortValIdx}::timestamptz) OR (ip."createdAt" = $${sortValIdx}::timestamptz AND ip.id ${op} $${idIdx}))
      `);
    } else if (sortBy === "relevance") {
      // Keyset comparison on composite rank
      whereClauses.push(`
        ((${buildCreatorSqlRankingExpression(Boolean(rawSearch))} ${op} $${sortValIdx}::float) OR (${buildCreatorSqlRankingExpression(Boolean(rawSearch))} = $${sortValIdx}::float AND ip.id ${op} $${idIdx}))
      `);
    } else {
      whereClauses.push(`
        ((${sortColumnSql} ${op} $${sortValIdx}::numeric) OR (${sortColumnSql} = $${sortValIdx}::numeric AND ip.id ${op} $${idIdx}))
      `);
    }
  }

  // Backward compatibility: If no cursor is passed but page > 1, apply OFFSET
  let offsetClause = "";
  if (!cursor && params.page && params.page > 1) {
    const skip = (params.page - 1) * limit;
    offsetClause = `OFFSET ${skip}`;
  }

  // Fetch limit + 1 to detect hasMore
  const queryLimit = limit + 1;
  const limitIdx = paramIdx;
  values.push(queryLimit);
  paramIdx++;

  const safeSortDir = String(sortOrder).toLowerCase() === "asc" ? "ASC" : "DESC";
  const sql = `
    SELECT 
      ip.id,
      ip."userId",
      ip."displayName",
      ip.bio,
      ip.avatar,
      ip.city,
      ip.state,
      ip."instagramHandle",
      ip."instagramFollowers",
      ip."instagramEngagementRate",
      ip."youtubeHandle",
      ip."youtubeSubscribers",
      ip."youtubeEngagementRate",
      ip.categories,
      ip.languages,
      ip."minRate",
      ip."maxRate",
      ip."minInstagramRate",
      ip."maxInstagramRate",
      ip."minYoutubeRate",
      ip."maxYoutubeRate",
      ip."followerAuthenticityScore",
      ip."contentQualityScore",
      ip."isFeatured",
      ip."featuredUntil",
      ip."totalDeals",
      ip."completedDeals",
      ip."averageRating",
      ip."totalReviews",
      ip."createdAt",
      ip."updatedAt",
      COALESCE(u."trustScore", 50) AS "userTrustScore",
      COALESCE(u.level, 1) AS "userLevel",
      COALESCE(u.xp, 0) AS "userXp"
      ${selectRankSql}
    FROM "InfluencerProfile" ip
    JOIN "User" u ON ip."userId" = u.id
    WHERE ${whereClauses.join(" AND ")}
    ORDER BY ${sortColumnSql} ${safeSortDir}, ip.id ${safeSortDir}
    LIMIT $${limitIdx}
    ${offsetClause}
  `;

  try {
    const rawRows = await client.$queryRawUnsafe<RawCreatorRow[]>(sql, ...values);

    const hasMore = rawRows.length > limit;
    const resultRows = hasMore ? rawRows.slice(0, limit) : rawRows;

    let nextCursor: string | null = null;
    const lastItem = hasMore && resultRows.length > 0 ? resultRows[resultRows.length - 1] : undefined;
    if (lastItem) {
      let sortVal: string | number = "";
      if (sortBy === "relevance") sortVal = Number(lastItem.rankScore || 0);
      else if (sortBy === "followers") sortVal = Number(lastItem.instagramFollowers || 0);
      else if (sortBy === "rating") sortVal = Number(lastItem.averageRating || 0);
      else if (sortBy === "rate") sortVal = Number(lastItem.minRate || 0);
      else sortVal = new Date(lastItem.createdAt).toISOString();

      nextCursor = encodeCursor({
        id: lastItem.id,
        sortValue: sortVal,
      });
    }

    const items: CreatorSearchResultItem[] = resultRows.map((r) => ({
      id: r.id,
      userId: r.userId,
      displayName: r.displayName,
      bio: r.bio,
      avatar: r.avatar,
      city: r.city,
      state: r.state,
      instagramHandle: r.instagramHandle,
      instagramFollowers: r.instagramFollowers,
      instagramEngagementRate: r.instagramEngagementRate,
      youtubeHandle: r.youtubeHandle,
      youtubeSubscribers: r.youtubeSubscribers,
      youtubeEngagementRate: r.youtubeEngagementRate,
      categories: r.categories,
      languages: r.languages,
      minRate: r.minRate,
      maxRate: r.maxRate,
      minInstagramRate: r.minInstagramRate,
      maxInstagramRate: r.maxInstagramRate,
      minYoutubeRate: r.minYoutubeRate,
      maxYoutubeRate: r.maxYoutubeRate,
      followerAuthenticityScore: r.followerAuthenticityScore,
      contentQualityScore: r.contentQualityScore,
      isFeatured: r.isFeatured,
      featuredUntil: r.featuredUntil,
      totalDeals: r.totalDeals,
      completedDeals: r.completedDeals,
      averageRating: r.averageRating,
      totalReviews: r.totalReviews,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      rankScore: r.rankScore ? Number(r.rankScore) : undefined,
      user: {
        trustScore: r.userTrustScore,
        level: r.userLevel,
        xp: r.userXp,
      },
    }));

    const result: CursorPaginationResult<CreatorSearchResultItem> = {
      items,
      nextCursor,
      hasMore,
      durationMs: Date.now() - start,
    };

    // Cache the response
    await setCachedSearchResults("creators", params, result);

    return result;
  } catch (error) {
    logger.error("Error executing creator search query", { error, params });
    throw error;
  }
}
