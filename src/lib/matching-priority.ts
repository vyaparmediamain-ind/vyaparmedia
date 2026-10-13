export type MatchingPriorityPreset =
  | "BALANCED"
  | "REACH_FOCUSED"
  | "TRUST_FOCUSED"
  | "ROI_FOCUSED"
  | "CUSTOM";

export interface MatchingWeights {
  category: number;
  engagement: number;
  authenticity: number;
  quality: number;
  roi: number;
}

export const MATCHING_PRIORITY_PRESETS: Record<MatchingPriorityPreset, MatchingWeights> = {
  BALANCED: {
    category: 0.20,
    engagement: 0.20,
    authenticity: 0.20,
    quality: 0.20,
    roi: 0.20,
  },
  REACH_FOCUSED: {
    category: 0.25,
    engagement: 0.35,
    authenticity: 0.10,
    quality: 0.10,
    roi: 0.20,
  },
  TRUST_FOCUSED: {
    category: 0.15,
    engagement: 0.15,
    authenticity: 0.35,
    quality: 0.25,
    roi: 0.10,
  },
  ROI_FOCUSED: {
    category: 0.20,
    engagement: 0.20,
    authenticity: 0.10,
    quality: 0.10,
    roi: 0.40,
  },
  CUSTOM: {
    category: 0.20,
    engagement: 0.20,
    authenticity: 0.20,
    quality: 0.20,
    roi: 0.20,
  },
};

export interface MatchingPriorityMeta {
  id: MatchingPriorityPreset;
  label: string;
  tagline: string;
  description: string;
  badge: string;
  accentClass: string;
  highlights: string[];
}

export const MATCHING_PRIORITY_META: Record<MatchingPriorityPreset, MatchingPriorityMeta> = {
  BALANCED: {
    id: "BALANCED",
    label: "Balanced (Default)",
    tagline: "Equal weight across all 5 dimensions",
    description: "Evaluates niche fit, engagement, creator authenticity, track record, and CPV efficiency equally (20% each).",
    badge: "20% Each",
    accentClass: "border-primary/40 bg-primary/5 text-primary",
    highlights: ["Category 20%", "Engagement 20%", "Authenticity 20%", "Quality 20%", "ROI 20%"],
  },
  REACH_FOCUSED: {
    id: "REACH_FOCUSED",
    label: "Reach & Engagement",
    tagline: "Prioritize viral reach and audience activity",
    description: "Gives higher priority to creator engagement rate (35%) and category relevance (25%) for maximum audience viral spread.",
    badge: "Engagement 35%",
    accentClass: "border-blue-500/40 bg-blue-500/5 text-blue-500",
    highlights: ["Engagement 35%", "Category 25%", "ROI 20%", "Quality 10%", "Authenticity 10%"],
  },
  TRUST_FOCUSED: {
    id: "TRUST_FOCUSED",
    label: "Trust & Quality",
    tagline: "Prioritize audience authenticity and reviews",
    description: "Maximizes follower authenticity scores (35%) and completion/quality rating (25%) to safeguard brand reputation.",
    badge: "Trust 35%",
    accentClass: "border-emerald-500/40 bg-emerald-500/5 text-emerald-500",
    highlights: ["Authenticity 35%", "Quality 25%", "Category 15%", "Engagement 15%", "ROI 10%"],
  },
  ROI_FOCUSED: {
    id: "ROI_FOCUSED",
    label: "Maximum ROI / CPV",
    tagline: "Prioritize lowest cost per effective view",
    description: "Heavy weight on benchmarked Cost-Per-View (40%) to ensure maximum commercial return for your campaign budget.",
    badge: "ROI 40%",
    accentClass: "border-amber-500/40 bg-amber-500/5 text-amber-500",
    highlights: ["ROI (CPV) 40%", "Category 20%", "Engagement 20%", "Quality 10%", "Authenticity 10%"],
  },
  CUSTOM: {
    id: "CUSTOM",
    label: "Custom Weights (Sliders)",
    tagline: "Fine-tune individual pillar weightings",
    description: "Configure custom percentage weights across Category Relevance, Engagement Rate, Authenticity, Platform Quality, and Commercial CPV.",
    badge: "Fine-Tuned",
    accentClass: "border-purple-500/40 bg-purple-500/5 text-purple-500",
    highlights: ["Custom sliders", "Tailored percentages"],
  },
};

export function encodeMatchingPriority(
  guidelines: string | null | undefined,
  priority: MatchingPriorityPreset = "BALANCED",
  customWeights?: MatchingWeights | null
): string | null {
  const clean = stripMatchingPriority(guidelines);
  let tags = "";
  if (priority !== "BALANCED" || customWeights) {
    tags += `[MATCHING_PRIORITY:${priority}]`;
  }
  if (customWeights) {
    tags += `[MATCHING_WEIGHTS:${JSON.stringify(customWeights)}]`;
  }
  if (!tags) return clean || null;
  return clean ? `${tags}\n${clean}` : tags;
}

export function decodeMatchingPriority(
  guidelines: string | null | undefined
): {
  priority: MatchingPriorityPreset;
  customWeights?: MatchingWeights | undefined;
  cleanGuidelines: string | null;
} {
  if (!guidelines) {
    return { priority: "BALANCED", cleanGuidelines: null };
  }

  let priority: MatchingPriorityPreset = "BALANCED";
  const priorityMatch = guidelines.match(
    /\[MATCHING_PRIORITY:(BALANCED|REACH_FOCUSED|TRUST_FOCUSED|ROI_FOCUSED|CUSTOM)\]/
  );
  if (priorityMatch && priorityMatch[1]) {
    priority = priorityMatch[1] as MatchingPriorityPreset;
  }

  let customWeights: MatchingWeights | undefined = undefined;
  const weightsMatch = guidelines.match(/\[MATCHING_WEIGHTS:(\{.*?\})\]/);
  if (weightsMatch && weightsMatch[1]) {
    try {
      customWeights = JSON.parse(weightsMatch[1]) as MatchingWeights;
    } catch {
      /* ignore invalid JSON */
    }
  }

  const cleanGuidelines = guidelines
    .replace(/\[MATCHING_PRIORITY:(BALANCED|REACH_FOCUSED|TRUST_FOCUSED|ROI_FOCUSED|CUSTOM)\]\n?/, "")
    .replace(/\[MATCHING_WEIGHTS:\{.*?\}\]\n?/, "")
    .trim();

  return { priority, customWeights, cleanGuidelines: cleanGuidelines || null };
}

export function stripMatchingPriority(guidelines: string | null | undefined): string | null {
  return decodeMatchingPriority(guidelines).cleanGuidelines;
}
