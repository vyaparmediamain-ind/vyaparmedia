"use client";

import { useEffect, useState, useCallback } from "react";
import { MarketRangeCard } from "@/components/pricing/MarketRangeCard";
import { MarketRangeReportModal } from "@/components/reports/MarketRangeReportModal";

interface PricingData {
  profile: {
    id: string;
    displayName: string | null;
    fairRateMinPaise: number | null;
    fairRateMaxPaise: number | null;
    confidence: string | null;
    dataQuality: string | null;
    computedAt: string | null;
    engineVersion: string | null;
  };
  latestEvaluation: {
    id: string;
    platform: string;
    contentType: string;
    createdAt: string;
    output: {
      basePaise: number;
      minPaise: number;
      maxPaise: number;
      expectedViews: number;
      viewStatistic: string;
      confidence: string;
      dataQuality: string;
      flags: string[];
      explanation: Array<{
        step: string;
        description: string;
        contributionPaise: number;
        runningTotalPaise: number;
      }>;
    };
  } | null;
}

interface FairPriceGuidanceCardProps {
  readonly quotedRatePaise?: number | null | undefined;
}

export function FairPriceGuidanceCard({ quotedRatePaise }: Readonly<FairPriceGuidanceCardProps> = {}) {
  const [data, setData] = useState<PricingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRecomputing, setIsRecomputing] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  const fetchPricing = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch("/api/pricing/me");
      if (!res.ok) {
        // Flag disabled (403) or not found: gracefully hide
        setData(null);
        return;
      }
      const json = await res.json();
      if (json.success && json.data?.profile?.fairRateMinPaise) {
        setData(json.data);
      } else {
        setData(null);
      }
    } catch {
      // Network failure: fail silently, widget remains hidden
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPricing();
  }, [fetchPricing]);

  const handleRecompute = async () => {
    setIsRecomputing(true);
    try {
      const res = await fetch("/api/pricing/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: "INSTAGRAM",
          contentType: "REEL",
          forceFresh: true,
        }),
      });
      if (res.ok) {
        await fetchPricing();
      }
    } catch {
      // Ignore evaluation errors on retry
    } finally {
      setIsRecomputing(false);
    }
  };

  if (loading) {
    return <MarketRangeCard isLoading={true} className="mb-6" />;
  }

  if (error) {
    return (
      <MarketRangeCard
        error={error}
        onRecompute={handleRecompute}
        isRecomputing={isRecomputing}
        className="mb-6"
      />
    );
  }

  if (!data?.profile?.fairRateMinPaise || !data?.profile?.fairRateMaxPaise) {
    return (
      <MarketRangeCard
        minPaise={0}
        maxPaise={0}
        onRecompute={handleRecompute}
        isRecomputing={isRecomputing}
        className="mb-6"
      />
    );
  }

  const { fairRateMinPaise, fairRateMaxPaise, confidence, dataQuality, id: profileId } = data.profile;
  const explanation = data.latestEvaluation?.output.explanation || [];
  const flags = data.latestEvaluation?.output.flags || [];

  return (
    <>
      <MarketRangeCard
        minPaise={fairRateMinPaise}
        maxPaise={fairRateMaxPaise}
        confidence={confidence}
        dataQuality={dataQuality}
        explanation={explanation}
        flags={flags}
        quotedRatePaise={quotedRatePaise}
        onRecompute={handleRecompute}
        isRecomputing={isRecomputing}
        onViewReport={profileId ? () => setShowReportModal(true) : undefined}
        className="mb-6"
      />
      {profileId && (
        <MarketRangeReportModal
          influencerId={profileId}
          isOpen={showReportModal}
          onClose={() => setShowReportModal(false)}
        />
      )}
    </>
  );
}
