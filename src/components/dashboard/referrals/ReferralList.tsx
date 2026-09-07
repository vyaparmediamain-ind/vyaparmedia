import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { Badge, Button } from "@/components/ui";

interface Referral {
id: string;
name: string;
email: string;
joinedAt: string;
status: string;
type: string;
earnings: number;
}

interface ReferralsResponse {
referrals?: Referral[];
}

interface ReferralListProps {
  readonly onShareClick?: () => void;
}

function getFilterLabel(filterKey: string): string {
  if (filterKey === "ALL") return "All";
  if (filterKey === "ACTIVE") return "🟢 Active";
  return "🟡 Pending";
}

export default function ReferralList({ onShareClick }: ReferralListProps) {
  const [filter, setFilter] = useState("ALL");
  const { data, isLoading } = useSWR<ReferralsResponse>("/api/referrals/list", fetcher);

  const referrals = data?.referrals || [];

  const filteredReferrals =
    filter === "ALL" ? referrals : referrals.filter((r) => r.status === filter);

  if (isLoading) {
    return (
      <div className="card p-12 text-center flex flex-col items-center justify-center">
        <div className="loading mx-auto mb-3" />
        <span className="text-xs text-secondary">Loading partner records...</span>
      </div>
    );
  }

  if (referrals.length === 0) {
    return (
      <div className="card p-10 text-center flex flex-col items-center justify-center border border-card rounded-2xl bg-secondary">
        <div className="text-4xl mb-3">🎁</div>
        <h3 className="text-xl font-bold mb-2 text-white">No Partners Referred Yet</h3>
        <p className="text-secondary text-sm max-w-400 mb-6 leading-relaxed">
          Share your unique invite code with creator friends and brands. Every time they complete a deal, you earn platform rewards!
        </p>
        {onShareClick && (
          <Button variant="primary" onClick={onShareClick} className="flex items-center gap-2">
            <span>🚀</span>
            <span>Invite Your First Partner</span>
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="card p-0 overflow-hidden border border-card rounded-2xl referral-list-card bg-secondary">
      <div className="p-6 border-b border-card flex justify-between items-center flex-wrap gap-4">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">📜</span>
          <h3 className="text-base font-bold text-white m-0">
            Referred Partners
          </h3>
          <Badge variant="primary" className="text-xs font-bold font-mono">
            {referrals.length}
          </Badge>
        </div>

        <div className="flex gap-1.5 p-1 rounded-lg bg-tertiary border border-card">
          {["ALL", "ACTIVE", "PENDING"].map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className="text-xs font-semibold rounded-md border-none px-3 py-1.5 cursor-pointer transition-all referral-filter-button"
              data-active={filter === f ? "true" : "false"}
            >
              {getFilterLabel(f)}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-card text-xs font-bold text-muted uppercase tracking-wider bg-tertiary">
              <th className="p-4 text-left">Partner</th>
              <th className="p-4 text-left">Account Type</th>
              <th className="hide-mobile p-4 text-left">Joined Date</th>
              <th className="p-4 text-center">Status</th>
              <th className="p-4 text-right">Lifetime Earnings</th>
            </tr>
          </thead>
          <tbody>
            {filteredReferrals.map((ref) => (
              <tr
                key={ref.id}
                className="border-b border-card text-sm referral-row hover:bg-tertiary transition-colors"
              >
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center font-extrabold text-sm rounded-full text-white w-9 h-9 flex-shrink-0 referral-avatar">
                      {ref.name ? ref.name.charAt(0).toUpperCase() : "?"}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-white truncate">
                        {ref.name || "Anonymous User"}
                      </div>
                      <div className="text-xs text-secondary truncate font-mono">
                        {ref.email}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="p-4">
                  <span
                    className="font-bold rounded-md text-2xs uppercase px-2.5 py-1 referral-type-badge inline-block"
                    data-type={ref.type}
                  >
                    {ref.type === "INFLUENCER" ? "Creator" : ref.type}
                  </span>
                </td>
                <td className="hide-mobile p-4 text-secondary text-xs">
                  {new Date(ref.joinedAt).toLocaleDateString("en-IN", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </td>
                <td className="p-4 text-center">
                  <span
                    className="inline-flex items-center text-xs font-semibold rounded-md gap-1.5 px-2.5 py-1 referral-status-badge"
                    data-status={ref.status}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-current referral-status-dot" />
                    {ref.status === "ACTIVE" ? "Active" : "Pending"}
                  </span>
                </td>
                <td className="p-4 text-right font-extrabold text-emerald font-mono">
                  {ref.earnings > 0
                    ? `₹${(ref.earnings / 100).toLocaleString("en-IN")}`
                    : "₹0"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredReferrals.length === 0 && (
        <div className="p-8 text-center text-secondary text-sm">
          No records matching the <strong className="text-white">{filter}</strong> filter.
        </div>
      )}
    </div>
  );
}
