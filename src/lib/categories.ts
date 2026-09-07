/**
 * Shared categories constant as single source of truth.
 * Ensures consistent filtering, database tags, and UI labels.
 */
export const ALL_CATEGORIES = [
  "Fashion",
  "Beauty",
  "Lifestyle",
  "Food",
  "Travel",
  "Fitness",
  "Technology",
  "Gaming",
  "Entertainment",
  "Education",
  "Business",
  "Finance",
  "Health",
  "Parenting",
  "Pets",
  "Sports",
  "Music",
  "Art",
  "Automotive",
  "Real Estate",
] as const;

export type Category = typeof ALL_CATEGORIES[number];
