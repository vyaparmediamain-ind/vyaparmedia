import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import EmptyState from "@/components/ui/EmptyState";

interface Challenge {
challengeId: string;
title: string;
description: string;
icon: string;
type: string;
goal: number;
xpReward: number;
bonusPerk: string | null;
difficulty: string;
progress: number;
completed: boolean;
completedAt: Date | null;
}

interface ChallengesResponse {
data?: Challenge[];
}

const renderChallengeIcon = (icon: string) => {
  const commonProps = {
    width: 32,
    height: 32,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: "text-[var(--color-primary)]",
  };

  switch (icon) {
    case "💼":
      return (
        <svg {...commonProps}>
          <rect width="20" height="14" x="2" y="7" rx="2" ry="2" />
          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
        </svg>
      );
    case "⚡":
      return (
        <svg {...commonProps}>
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      );
    case "✅":
      return (
        <svg {...commonProps}>
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      );
    case "🎯":
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="6" />
          <circle cx="12" cy="12" r="2" />
        </svg>
      );
    case "⭐":
      return (
        <svg {...commonProps}>
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      );
    case "🔬":
      return (
        <svg {...commonProps}>
          <path d="M6 18h8" />
          <path d="M3 22h18" />
          <path d="M14 22a7 7 0 1 0-14 0" />
          <path d="M9 14h2" />
          <path d="M9 12a3 3 0 0 1 6 0v5" />
          <path d="M12 2v3" />
        </svg>
      );
    case "⏰":
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
          <path d="M12 2a15.3 15.3 0 0 1 4-1.5M12 2a15.3 15.3 0 0 0-4-1.5" />
        </svg>
      );
    case "🏃":
      return (
        <svg {...commonProps}>
          <circle cx="18" cy="5" r="1" />
          <path d="M14 7h-4v3l-4 3 1.5 1.5L10 12l2-1.5V17l4 3 1-1.5L14.5 15V9.5L17 8.5" />
        </svg>
      );
    case "💰":
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="16" />
          <path d="M16 10H12a2 2 0 0 0 0 4h4a2 2 0 0 1 0 4H12" />
        </svg>
      );
    case "💸":
      return (
        <svg {...commonProps}>
          <rect width="20" height="12" x="2" y="6" rx="2" />
          <circle cx="12" cy="12" r="2" />
          <path d="M6 12h.01M18 12h.01" />
        </svg>
      );
    case "👥":
      return (
        <svg {...commonProps}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case "🌐":
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
          <path d="M2 12h20" />
        </svg>
      );
    case "✍️":
      return (
        <svg {...commonProps}>
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
      );
    case "🚀":
      return (
        <svg {...commonProps}>
          <path d="M4.5 16.5c-1.5 1.5-2.5 3.5-2.5 5.5C4 22 6 21 7.5 19.5" />
          <path d="M12 12l9-9-9 9z" />
          <path d="M9 15l-4.5 4.5" />
          <path d="M15 9l4.5-4.5" />
          <path d="M12 12c-2.5 2.5-6.5 2.5-9 0" />
          <path d="M12 12c2.5-2.5 2.5-6.5 0-9" />
        </svg>
      );
    case "📣":
      return (
        <svg {...commonProps}>
          <path d="M18 8a3 3 0 0 0-3-3H5a3 3 0 0 0-3 3v8a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V8Z" />
          <path d="M22 6v12" />
        </svg>
      );
    case "🔭":
      return (
        <svg {...commonProps}>
          <path d="m10.09 14.59-3.54-3.54" />
          <path d="M21 3l-8.5 8.5" />
          <path d="M14 5l6 6" />
          <path d="M12.5 11.5l2.5 2.5" />
          <path d="m3 21 6-6" />
        </svg>
      );
    default:
      return <span className="text-2xl">{icon}</span>;
  }
};

export default function WeeklyChallenges() {
const { data, isLoading: loading } = useSWR<ChallengesResponse>("/api/challenges", fetcher);
const challenges = data?.data || [];

if (loading) {
return (
<div className="card p-8 text-center">
<div className="loading"></div>
</div>
);
}

if (challenges.length === 0) {
return (
<EmptyState
emoji=""
title="No Challenges This Week"
description="Check back next week for new challenges!"
/>
);
}

const getDifficultyColor = (difficulty: string) => {
switch (difficulty) {
case "EASY":
return "bg-green-500";
case "MEDIUM":
return "bg-yellow-500";
case "HARD":
return "bg-red-500";
default:
return "bg-gray-500";
}
};

const getDifficultyLabel = (difficulty: string) => {
switch (difficulty) {
case "EASY":
return "Easy";
case "MEDIUM":
return "Medium";
case "HARD":
return "Hard";
default:
return difficulty;
}
};

return (
<div className="space-y-4">
<div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-2">
<h2 className="text-2xl font-bold">Weekly Challenges</h2>
<span className="text-sm text-secondary">
Complete challenges to earn XP and rewards!
</span>
</div>

{challenges.map((challenge) => {
const progressPercentage = Math.min(
100,
(challenge.progress / challenge.goal) * 100
);

return (
<div
key={challenge.challengeId}
className={`card p-6 border rounded-2xl ${
challenge.completed
? "bg-secondary border-card"
: "bg-card border-card"
}`}
>
<div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-4 gap-4">
<div className="flex items-center gap-4">
<div className="flex-shrink-0">{renderChallengeIcon(challenge.icon)}</div>
<div>
<h3 className="text-lg font-semibold mb-1">
{challenge.title}
{challenge.completed && (
<span className="ml-2 text-emerald text-sm font-bold">
✓ Completed
</span>
)}
</h3>
<p className="text-secondary text-sm">
{challenge.description}
</p>
</div>
</div>
<div className="text-left sm:text-right flex-shrink-0">
<div className="text-2xl font-bold gradient-text">
+{challenge.xpReward} XP
</div>
{challenge.bonusPerk && (
<div className="text-xs text-secondary mt-1">
{challenge.bonusPerk}
</div>
)}
<div
className={`inline-block px-2 py-1 rounded text-xs font-medium text-white mt-2 ${getDifficultyColor(
challenge.difficulty
)}`}
>
{getDifficultyLabel(challenge.difficulty)}
</div>
</div>
</div>

<div className="mb-2">
<div className="flex justify-between text-sm mb-1">
<span className="text-secondary">
Progress
</span>
<span className="font-medium">
{challenge.progress} / {challenge.goal}
</span>
</div>
<div className="w-full bg-tertiary rounded-full h-3 overflow-hidden">
{(() => {
  const safeId = challenge.challengeId.toLowerCase().replace(/[^a-z0-9]/g, "-");
  const progressClass = `challenge-progress-${safeId}`;
  return (
    <>
      <style>{`
        .${progressClass} {
          width: ${progressPercentage}%;
        }
      `}</style>
      <div
        className={`h-3 rounded-full transition-all ${progressClass} ${
          challenge.completed
            ? "bg-emerald"
            : "bg-primary"
        }`}
      />
    </>
  );
})()}
</div>
</div>

{challenge.completed && challenge.completedAt && (
<div className="text-xs text-muted mt-2">
Completed on {new Date(challenge.completedAt).toLocaleDateString()}
</div>
)}
</div>
);
})}
</div>
);
}
