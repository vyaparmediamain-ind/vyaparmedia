"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { formatUserError } from "@/lib/user-messages";
import { haptic } from "@/lib/haptics";
import {
  CampaignApplication,
  CampaignDetailResponse,
  RawCampaign,
  normalizeCampaign,
  calculateRecommendedPayout,
  buildApplicationActionRequest,
} from "./CampaignDetailHelpers";

function extractMessage(err: unknown): string {
  return formatUserError(err, "Failed to process campaign request. Please try again.");
}

interface UseCampaignDetailProps {
  readonly campaignId: string | null | undefined;
  readonly user: { id: string; userType?: string };
  readonly influencerProfile: {
    readonly instagramFollowers: number | null;
    readonly instagramEngagementRate: number | null;
    readonly youtubeSubscribers: number | null;
    readonly youtubeEngagementRate: number | null;
  } | null;
  readonly router: ReturnType<typeof useRouter>;
}

export function useCampaignDetail({
  campaignId,
  user,
  influencerProfile,
  router,
}: UseCampaignDetailProps) {
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [proposal, setProposal] = useState("");
  const [proposedRate, setProposedRate] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [applications, setApplications] = useState<CampaignApplication[]>([]);
  const [applicationsLoading, setApplicationsLoading] = useState(false);
  const [applicationActionId, setApplicationActionId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const { data: payload, isLoading: loading, error: fetchErr, mutate: refreshCampaign } = useSWR<CampaignDetailResponse>(
    campaignId ? `/api/campaigns/${encodeURIComponent(campaignId)}` : null,
    fetcher
  );

  const rawCampaign: RawCampaign | null = payload?.data?.campaign || payload?.campaign || (payload?.data && "id" in payload.data ? (payload.data as RawCampaign) : null);
  const campaign = useMemo(() => rawCampaign ? normalizeCampaign(rawCampaign) : null, [rawCampaign]);
  let error = "";
  if (fetchErr) {
    error = "Failed to load campaign";
  } else if (!rawCampaign && payload) {
    error = payload?.message || "Campaign not found";
  }

  const hasApplied = Boolean(payload?.data?.hasApplied || rawCampaign?.hasApplied || payload?.hasApplied);
  const applicationStatus = payload?.data?.applicationStatus || rawCampaign?.applicationStatus || payload?.applicationStatus || null;
  const dealId = payload?.data?.dealId || rawCampaign?.dealId || payload?.dealId || null;

  const recommendedPayout = useMemo(() => {
    if (!influencerProfile || !campaign) return 0;
    return calculateRecommendedPayout(
      {
        instagramFollowers: influencerProfile.instagramFollowers,
        instagramEngagementRate: influencerProfile.instagramEngagementRate,
        youtubeSubscribers: influencerProfile.youtubeSubscribers,
        youtubeEngagementRate: influencerProfile.youtubeEngagementRate,
      },
      campaign.deliverables,
      campaign.perInfluencerBudget
    );
  }, [influencerProfile, campaign]);

  const isOwner = Boolean(campaign?.brand?.userId && campaign?.brand?.userId === user?.id);
  const canApply =
    user?.userType === "INFLUENCER" &&
    campaign?.status === "ACTIVE" &&
    !hasApplied &&
    Boolean(campaign?.applicationDeadline && new Date(campaign.applicationDeadline) > new Date());

  const fetchApplications = useCallback(async () => {
    if (!campaignId || !isOwner) return;
    setApplicationsLoading(true);
    try {
      const result = await apiClient.applications.list(
        { campaignId },
        { cache: "no-store" } as RequestInit,
      ) as { success?: boolean; data?: { applications?: CampaignApplication[] }; message?: string };
      if (!result?.success) {
        throw new Error(result?.message || "Failed to load applications");
      }
      setApplications(result?.data?.applications || []);
    } catch (appError: unknown) {
      setNotice({
        type: "error",
        message: extractMessage(appError) || "Failed to load applications",
      });
    } finally {
      setApplicationsLoading(false);
    }
  }, [campaignId, isOwner]);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  const handleApplicationAction = async (
    applicationId: string,
    action: "accept" | "reject",
  ) => {
    setApplicationActionId(applicationId);
    setNotice(null);
    try {
      const requestInit = buildApplicationActionRequest(action, applicationId, applications);
      if (!requestInit) {
        setApplicationActionId(null);
        return;
      }

      const result = await apiClient.applications.action(
        applicationId,
        action,
        requestInit.body ? JSON.parse(requestInit.body as string) : undefined,
      ) as { success?: boolean; message?: string };

      if (!result?.success) {
        throw new Error(result?.message || `Failed to ${action} application`);
      }

      haptic.success();
      setNotice({
        type: "success",
        message:
          action === "accept"
            ? "Application accepted. Deal has been initiated."
            : "Application rejected.",
      });
      await fetchApplications();
      router.refresh();
    } catch (actionError: unknown) {
      setNotice({
        type: "error",
        message: extractMessage(actionError) || `Failed to ${action} application`,
      });
    } finally {
      setApplicationActionId(null);
    }
  };

  const handleApply = async () => {
    if (!campaign) return;
    if (proposal.trim().length < 50) {
      setNotice({ type: "error", message: "Please write at least 50 characters in proposal." });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await apiClient.applications.apply({
        campaignId: campaign.id,
        proposal: proposal.trim(),
        proposedRate: Math.max(1, Math.round(proposedRate * 100)),
      }) as { success?: boolean; message?: string };

      if (!result?.success) {
        throw new Error(result?.message || "Failed to submit application");
      }

      haptic.success();
      setShowApplyModal(false);
      setNotice({ type: "success", message: "Application submitted successfully." });
      refreshCampaign();
      router.push("/dashboard/applications");
    } catch (applyError: unknown) {
      setNotice({ type: "error", message: extractMessage(applyError) || "Failed to submit application" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCampaignAction = async (action: "ACTIVATE" | "CANCEL") => {
    if (!campaignId) return;

    const confirmText =
      action === "ACTIVATE"
        ? "Activate this campaign and hold funds from wallet?"
        : "Cancel this campaign? This cannot be undone.";

    if (!globalThis.confirm(confirmText)) return;

    try {
      const result = await apiClient.campaigns.patchAction(
        campaignId,
        action,
      ) as { success?: boolean; message?: string };

      if (!result?.success) {
        throw new Error(result?.message || "Campaign update failed");
      }

      refreshCampaign();
      setNotice({ type: "success", message: result?.message || "Campaign updated successfully" });
      router.refresh();
    } catch (actionError: unknown) {
      setNotice({ type: "error", message: extractMessage(actionError) || "Campaign update failed" });
    }
  };

  return {
    loading,
    error,
    campaign,
    refreshCampaign,
    showApplyModal,
    setShowApplyModal,
    proposal,
    setProposal,
    proposedRate,
    setProposedRate,
    isSubmitting,
    applications,
    applicationsLoading,
    applicationActionId,
    notice,
    setNotice,
    hasApplied,
    applicationStatus,
    dealId,
    recommendedPayout,
    isOwner,
    canApply,
    fetchApplications,
    handleApplicationAction,
    handleApply,
    handleCampaignAction,
  };
}
