"use client";

import type { Profile } from "./ProfileTab";
import { Input } from "@/components/ui";

interface RatesTabProps {
profile: Profile;
setProfile: React.Dispatch<React.SetStateAction<Profile | null>>;
}

export default function RatesTab({ profile, setProfile }: Readonly<RatesTabProps>) {
  return (
    <div className="card max-w-600">
      <h2 className="text-base font-bold mb-5">Your Rate Card</h2>
      <p className="text-sm text-secondary mb-6">
        Set your baseline rates for brand collaborations. This helps match you with relevant campaigns.
      </p>

      <div className="grid-2 gap-4 mb-6">
        <Input
          id="min-general-rate"
          label="Minimum General Rate (₹)"
          type="number"
          placeholder="10000"
          value={profile.minRate ? profile.minRate / 100 : ""}
          onChange={(e) =>
            setProfile({
              ...profile,
              minRate: Number.parseInt(e.target.value, 10) * 100 || 0,
            })
          }
          fullWidth
        />
        <Input
          id="max-general-rate"
          label="Maximum General Rate (₹)"
          type="number"
          placeholder="50000"
          value={profile.maxRate ? profile.maxRate / 100 : ""}
          onChange={(e) =>
            setProfile({
              ...profile,
              maxRate: Number.parseInt(e.target.value, 10) * 100 || 0,
            })
          }
          fullWidth
        />
      </div>

      <h4 className="text-sm font-bold mb-3 border-t border-card pt-4">
        Instagram Collaboration Rates
      </h4>
      <div className="grid-2 gap-4 mb-6">
        <Input
          id="min-instagram-rate"
          label="Min Instagram Rate (₹)"
          type="number"
          placeholder="2000"
          value={profile.minInstagramRate ? profile.minInstagramRate / 100 : ""}
          onChange={(e) =>
            setProfile({
              ...profile,
              minInstagramRate: Number.parseInt(e.target.value, 10) * 100 || 0,
            })
          }
          fullWidth
        />
        <Input
          id="max-instagram-rate"
          label="Max Instagram Rate (₹)"
          type="number"
          placeholder="10000"
          value={profile.maxInstagramRate ? profile.maxInstagramRate / 100 : ""}
          onChange={(e) =>
            setProfile({
              ...profile,
              maxInstagramRate: Number.parseInt(e.target.value, 10) * 100 || 0,
            })
          }
          fullWidth
        />
      </div>

      <h4 className="text-sm font-bold mb-3 border-t border-card pt-4">
        YouTube Collaboration Rates
      </h4>
      <div className="grid-2 gap-4 mb-6">
        <Input
          id="min-youtube-rate"
          label="Min YouTube Rate (₹)"
          type="number"
          placeholder="5000"
          value={profile.minYoutubeRate ? profile.minYoutubeRate / 100 : ""}
          onChange={(e) =>
            setProfile({
              ...profile,
              minYoutubeRate: Number.parseInt(e.target.value, 10) * 100 || 0,
            })
          }
          fullWidth
        />
        <Input
          id="max-youtube-rate"
          label="Max YouTube Rate (₹)"
          type="number"
          placeholder="25000"
          value={profile.maxYoutubeRate ? profile.maxYoutubeRate / 100 : ""}
          onChange={(e) =>
            setProfile({
              ...profile,
              maxYoutubeRate: Number.parseInt(e.target.value, 10) * 100 || 0,
            })
          }
          fullWidth
        />
      </div>

      <div className="p-4 bg-tertiary rounded-md">
        <p className="text-sm text-secondary flex items-start gap-2">
          <svg
            width={16}
            height={16}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <span>
            <strong>Pro Tip:</strong> Set realistic baseline rates that reflect your production effort and niche. You can always negotiate and send custom proposals to brands directly during campaign conversations.
          </span>
        </p>
      </div>
    </div>
  );
}
