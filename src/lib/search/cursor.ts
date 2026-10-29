import { CursorPayload, SortOrder } from "./types";

/**
 * Keyset Cursor Pagination Helper
 * 
 * Replaces expensive OFFSET queries with O(1) B-tree/composite index lookups.
 * Safe against concurrent insertions (no duplicates, no skipped items).
 */

export function encodeCursor(payload: CursorPayload): string {
  try {
    const json = JSON.stringify(payload);
    return Buffer.from(json, "utf-8").toString("base64url");
  } catch {
    return "";
  }
}

export function decodeCursor(cursorStr?: string | null): CursorPayload | null {
  if (!cursorStr || typeof cursorStr !== "string") return null;

  try {
    const json = Buffer.from(cursorStr, "base64url").toString("utf-8");
    const parsed = JSON.parse(json);

    if (
      parsed &&
      typeof parsed === "object" &&
      parsed.id !== undefined &&
      parsed.sortValue !== undefined
    ) {
      return {
        id: String(parsed.id),
        sortValue: parsed.sortValue,
      };
    }
  } catch {
    // Return null if invalid or corrupt cursor
  }

  return null;
}

/**
 * Builds Keyset pagination SQL clause
 * Example for DESC: ("sortCol" < $sortVal) OR ("sortCol" = $sortVal AND "id" < $id)
 */
export function buildKeysetSqlCondition(
  sortColumn: string,
  idColumn: string,
  sortOrder: SortOrder,
  sortValParamIndex: number,
  idParamIndex: number,
  castType?: string,
): string {
  const op = sortOrder === "asc" ? ">" : "<";
  const cast = castType ? `::${castType}` : "";

  return `((${sortColumn} ${op} $${sortValParamIndex}${cast}) OR (${sortColumn} = $${sortValParamIndex}${cast} AND ${idColumn} ${op} $${idParamIndex}))`;
}
