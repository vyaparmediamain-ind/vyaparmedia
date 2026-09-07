"use client";

import { logger } from "@/lib/logger-client";
import React, { useState, useEffect } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Input, Select, Textarea, Card } from "@/components/ui";
import {
  CampaignFormData,
  validateCampaignForm,
} from "@/components/dashboard/campaigns/create/CampaignCreateHelpers";
import { ProductSeedingCard } from "@/components/dashboard/campaigns/create/ProductSeedingCard";
import { DeliverablesList } from "@/components/dashboard/campaigns/create/DeliverablesList";
import { ALL_CATEGORIES } from "@/lib/categories";

interface DraftCampaignData {
  status?: string;
  title?: string;
  description?: string;
  requirements?: string;
  totalBudget?: number;
  perInfluencerBudget?: number;
  targetCategories?: string[];
  targetCities?: string[];
  targetGender?: string;
  targetAgeMin?: number | null;
  targetAgeMax?: number | null;
  minFollowers?: number;
  maxFollowers?: number | null;
  maxInfluencers?: number | null;
  applicationDeadline?: string;
  contentDeadline?: string;
  postingDeadline?: string;
  requiresProduct?: boolean;
  productName?: string;
  productValue?: number;
  productDescription?: string;
  deliverables?: Array<{ type: string; count: number; rate?: number }>;
}

interface DraftCampaignResponse {
  campaign?: DraftCampaignData;
  data?: { campaign?: DraftCampaignData };
}

const INITIAL_FORM_DATA: CampaignFormData = {
  title: "",
  description: "",
  requirements: "",
  totalBudget: 5000,
  perInfluencerBudget: 1000,
  targetCategories: [],
  targetCities: [],
  targetGender: "ANY",
  targetAgeMin: null,
  targetAgeMax: null,
  minFollowers: 1000,
  maxFollowers: null,
  maxInfluencers: null,
  applicationDeadline: "",
  contentDeadline: "",
  postingDeadline: "",
  requiresProduct: false,
  productName: "",
  productValue: 0,
  productDescription: "",
  deliverables: [{ type: "INSTAGRAM_POST", count: 1, rate: 1000 }],
};

function formatDateForInput(dateStr?: string | null): string {
  if (!dateStr) return "";
  return dateStr.split("T")[0] || "";
}

function mapDraftCampaignToFormData(campaign: DraftCampaignData): CampaignFormData {
  return {
    title: campaign.title || "",
    description: campaign.description || "",
    requirements: campaign.requirements || "",
    totalBudget: (campaign.totalBudget || 0) / 100,
    perInfluencerBudget: (campaign.perInfluencerBudget || 0) / 100,
    targetCategories: campaign.targetCategories || [],
    targetCities: campaign.targetCities || [],
    targetGender: campaign.targetGender || "ANY",
    targetAgeMin: campaign.targetAgeMin ?? null,
    targetAgeMax: campaign.targetAgeMax ?? null,
    minFollowers: campaign.minFollowers || 0,
    maxFollowers: campaign.maxFollowers || null,
    maxInfluencers: campaign.maxInfluencers || null,
    applicationDeadline: formatDateForInput(campaign.applicationDeadline),
    contentDeadline: formatDateForInput(campaign.contentDeadline),
    postingDeadline: formatDateForInput(campaign.postingDeadline),
    requiresProduct: campaign.requiresProduct || false,
    productName: campaign.productName || "",
    productValue: (campaign.productValue || 0) / 100,
    productDescription: campaign.productDescription || "",
    deliverables: (campaign.deliverables || []).map((d) => ({
      type: d.type,
      count: d.count,
      rate: (d.rate || 0) / 100,
    })),
  };
}

function toggleCategorySelection(prevCategories: string[], cat: string): string[] {
  if (prevCategories.includes(cat)) {
    return prevCategories.filter((c) => c !== cat);
  }
  if (prevCategories.length >= 5) {
    return prevCategories;
  }
  return [...prevCategories, cat];
}

function computeCampaignBudgets(
  deliverables: Array<{ rate?: number; count?: number }>,
  maxInfluencers: number | null
) {
  const perInfluencer = deliverables.reduce(
    (sum, d) => sum + (d.rate || 0) * (d.count || 0),
    0
  );
  const total = maxInfluencers !== null
    ? perInfluencer * maxInfluencers
    : perInfluencer;
  return { perInfluencer, total };
}

export default function CreateCampaignClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const invitedInfluencerId = searchParams.get("invite");
  const editCampaignId = searchParams.get("edit");

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isEditDraftLoading, setIsEditDraftLoading] = useState(!!editCampaignId);
  const [invitedInfluencer, setInvitedInfluencer] = useState<{
    displayName: string;
    instagramHandle?: string;
    youtubeHandle?: string;
  } | null>(null);

  const [formData, setFormData] = useState<CampaignFormData>(INITIAL_FORM_DATA);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [customCategory, setCustomCategory] = useState("");
  const [categories, setCategories] = useState<string[]>([...ALL_CATEGORIES]);

  useEffect(() => {
    if (!invitedInfluencerId) return;
    const fetchInfluencer = async () => {
      try {
        const res = await fetch(`/api/influencers/${encodeURIComponent(invitedInfluencerId)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.influencer) {
            setInvitedInfluencer(data.influencer);
          }
        }
      } catch (err) {
        logger.error("[campaign-create] Failed to fetch invited influencer details:", err);
      }
    };
    fetchInfluencer();
  }, [invitedInfluencerId]);

  const { data: draftData } = useSWR<DraftCampaignResponse>(
    editCampaignId ? `/api/campaigns/${editCampaignId}` : null,
    fetcher
  );

  useEffect(() => {
    if (!draftData) return;
    const campaign = draftData.campaign || draftData.data?.campaign;
    if (campaign?.status === "DRAFT") {
      setFormData(mapDraftCampaignToFormData(campaign));
    }
    setIsEditDraftLoading(false);
  }, [draftData]);

  const handleCategoryToggle = (cat: string) => {
    setFormData((prev) => ({
      ...prev,
      targetCategories: toggleCategorySelection(prev.targetCategories, cat),
    }));
  };

  const handleAddCustomCategory = () => {
    const trimmed = customCategory.trim();
    if (!trimmed) return;
    if (!categories.includes(trimmed)) {
      setCategories((prev) => [...prev, trimmed]);
      handleCategoryToggle(trimmed);
      setCustomCategory("");
    }
  };

  // Auto calculate perInfluencerBudget and totalBudget based on deliverables and maxInfluencers
  useEffect(() => {
    const { perInfluencer, total } = computeCampaignBudgets(
      formData.deliverables,
      formData.maxInfluencers
    );

    setFormData((prev) => {
      if (prev.perInfluencerBudget !== perInfluencer || prev.totalBudget !== total) {
        return {
          ...prev,
          perInfluencerBudget: perInfluencer,
          totalBudget: total,
        };
      }
      return prev;
    });
  }, [formData.deliverables, formData.maxInfluencers]);

  const handleSubmit = async (e: React.FormEvent, isDraft = false) => {
    e.preventDefault();
    setError("");
    setFieldErrors({});

    const valResult = validateCampaignForm(formData);
    if (!valResult.success) {
      if (valResult.fieldErrors) setFieldErrors(valResult.fieldErrors);
      if (valResult.error) setError(valResult.error);
      return;
    }

    setIsLoading(true);

    try {
      const applicationDeadline = formData.applicationDeadline
        ? new Date(formData.applicationDeadline)
        : null;
      const contentDeadline = new Date(formData.contentDeadline);
      const postingDeadline = new Date(formData.postingDeadline);

      const url = editCampaignId ? `/api/campaigns/${editCampaignId}` : "/api/campaigns";
      const method = editCampaignId ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          totalBudget: Math.round(formData.totalBudget * 100),
          perInfluencerBudget: Math.round(formData.perInfluencerBudget * 100),
          productValue: Math.round((formData.productValue || 0) * 100),
          deliverables: formData.deliverables.map((d) => ({
            ...d,
            rate: Math.round((d.rate || 0) * 100),
          })),
          maxFollowers: formData.maxFollowers || 0,
          maxInfluencers: formData.maxInfluencers || null,
          applicationDeadline: applicationDeadline?.toISOString(),
          contentDeadline: contentDeadline.toISOString(),
          postingDeadline: postingDeadline.toISOString(),
          invitedInfluencerId: invitedInfluencerId || undefined,
          status: isDraft ? "DRAFT" : "ACTIVE",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || "Failed to create campaign");
      }

      router.push("/dashboard/campaigns");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  let publishButtonContent: React.ReactNode = "Create Campaign";
  if (isLoading) {
    publishButtonContent = <span className="loading" />;
  } else if (editCampaignId) {
    publishButtonContent = "Save & Publish";
  }

  if (isEditDraftLoading) {
    return (
      <div className="flex justify-center items-center p-20">
        <span className="loading" aria-label="Loading campaign draft..." />
      </div>
    );
  }

  return (
    <div className="w-full max-w-800 mx-auto campaign-create-wrap">
      <h1 className="font-black mb-2 text-3xl bg-gradient-primary campaign-create-title">
        {editCampaignId ? "Edit Draft Campaign" : "Create New Campaign"}
      </h1>
      <p className="text-secondary mb-8 text-base">
        {editCampaignId
          ? "Update your draft campaign details before launching"
          : "Launch your campaign and connect with influencers"}
      </p>

      {invitedInfluencer && (
        <div className="flex items-center gap-3 mb-6 bg-indigo-subtle rounded-xl backdrop-blur campaign-invite-banner">
          <div className="rounded-full campaign-invite-dot" />
          <span className="font-medium text-sm text-primary">
            Inviting:{" "}
            <strong className="text-indigo">
              @{invitedInfluencer.instagramHandle || invitedInfluencer.youtubeHandle || invitedInfluencer.displayName}
            </strong>{" "}
            ({invitedInfluencer.displayName})
          </span>
        </div>
      )}

      <Card className="p-8 rounded-3xl">
        {error && (
          <div className="mb-6 bg-rose-subtle rounded-md text-rose px-4 py-3 campaign-error">
            {error}
          </div>
        )}

        <form onSubmit={(e) => handleSubmit(e, false)}>
          {/* Basic Info */}
          <Input
            label="Campaign Title"
            id="campaign-title"
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            required
            placeholder="e.g. Summer Collection Launch"
            className="mb-4"
            error={fieldErrors.title}
            fullWidth
          />

          <Textarea
            label="Overview / Description"
            id="campaign-description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            required
            placeholder="Describe your campaign goals and brand story..."
            className="mb-4"
            error={fieldErrors.description}
            fullWidth
          />

          <Textarea
            label="Requirements & Guidelines"
            id="campaign-requirements"
            value={formData.requirements}
            onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
            required
            placeholder="Specific requirements for influencers (e.g. 'Must use #SummerVibes', 'Link in bio')"
            className="mb-4"
            error={fieldErrors.requirements}
            fullWidth
          />

          {/* Target Audience */}
          <div className="form-group mb-6">
            <label className="label text-primary" htmlFor="custom-category-input">
              Target Categories (Select up to 5)
            </label>
            <div className="flex flex-wrap gap-2 mb-3">
              {categories.map((cat) => (
                <Button
                  key={cat}
                  type="button"
                  onClick={() => handleCategoryToggle(cat)}
                  variant={formData.targetCategories.includes(cat) ? "primary" : "ghost"}
                  className="cursor-pointer text-sm px-4-py-2 campaign-category-chip"
                  data-selected={formData.targetCategories.includes(cat) ? "true" : "false"}
                >
                  {cat}
                </Button>
              ))}
            </div>

            <div className="flex gap-2 items-center">
              <Input
                id="custom-category-input"
                type="text"
                placeholder="Enter custom category..."
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                className="max-w-200"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddCustomCategory();
                  }
                }}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={handleAddCustomCategory}
              >
                Add Category
              </Button>
            </div>
          </div>

          <Input
            label="Application Deadline (Optional)"
            id="application-deadline"
            type="date"
            value={formData.applicationDeadline}
            onChange={(e) => setFormData({ ...formData, applicationDeadline: e.target.value })}
            className="mb-4 color-scheme-dark"
            error={fieldErrors.applicationDeadline}
            fullWidth
          />

          <div className="grid-2 gap-4 mb-4">
            <Input
              label="Target Cities (Comma Separated)"
              id="target-cities"
              type="text"
              placeholder="e.g. Mumbai, Delhi"
              value={formData.targetCities.join(", ")}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  targetCities: e.target.value
                    .split(",")
                    .map((c) => c.trim())
                    .filter(Boolean),
                })
              }
              fullWidth
            />
            <Select
              label="Target Gender"
              id="target-gender"
              value={formData.targetGender}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  targetGender: e.target.value,
                })
              }
              fullWidth
            >
              <option value="ANY">Any</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
            </Select>
          </div>

          <div className="grid-2 gap-4 mb-4">
            <Input
              label="Min Target Age"
              id="target-age-min"
              type="number"
              placeholder="e.g. 18"
              value={formData.targetAgeMin || ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  targetAgeMin: e.target.value ? Number.parseInt(e.target.value, 10) : null,
                })
              }
              min={13}
              fullWidth
            />
            <Input
              label="Max Target Age"
              id="target-age-max"
              type="number"
              placeholder="e.g. 35"
              value={formData.targetAgeMax || ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  targetAgeMax: e.target.value ? Number.parseInt(e.target.value, 10) : null,
                })
              }
              min={13}
              fullWidth
            />
          </div>

          <div className="mb-4 grid gap-4 grid-cols-1 md:grid-cols-3">
            <Input
              label="Min Followers Req."
              id="min-followers"
              type="number"
              value={formData.minFollowers}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  minFollowers: Number.parseInt(e.target.value, 10) || 0,
                })
              }
              min={100}
              error={fieldErrors.minFollowers}
              fullWidth
            />
            <Input
              label="Max Followers Req. (Optional)"
              id="max-followers"
              type="number"
              value={formData.maxFollowers === null ? "" : formData.maxFollowers}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  maxFollowers: e.target.value ? Number.parseInt(e.target.value, 10) : null,
                })
              }
              min={1000}
              placeholder="No limit"
              error={fieldErrors.maxFollowers}
              fullWidth
            />
            <Input
              label="Max Influencer Slots"
              id="max-influencers"
              type="number"
              value={formData.maxInfluencers === null ? "" : formData.maxInfluencers}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  maxInfluencers: e.target.value ? Number.parseInt(e.target.value, 10) : null,
                })
              }
              min={1}
              max={100}
              placeholder="Unlimited"
              error={fieldErrors.maxInfluencers}
              fullWidth
            />
          </div>

          {/* Budget & Timeline */}
          <div className="grid-2 gap-4 mb-4">
            <Input
              label="Total Budget (Rs)"
              id="total-budget"
              type="number"
              value={formData.totalBudget}
              readOnly
              disabled
              required
              min={formData.requiresProduct ? 0 : 1000}
              fullWidth
              className="text-secondary bg-tertiary cursor-not-allowed"
            />
            <Input
              label="Budget Per Influencer (Approx Rs)"
              id="per-influencer-budget"
              type="number"
              value={formData.perInfluencerBudget}
              readOnly
              disabled
              required
              min={formData.requiresProduct ? 0 : 500}
              fullWidth
              className="text-secondary bg-tertiary cursor-not-allowed"
            />
          </div>

          <div className="grid-2 gap-4 mb-4">
            <Input
              label="Content Deadline"
              id="content-deadline"
              type="date"
              value={formData.contentDeadline}
              onChange={(e) => setFormData({ ...formData, contentDeadline: e.target.value })}
              required
              error={fieldErrors.contentDeadline}
              fullWidth
              className="color-scheme-dark"
            />
            <Input
              label="Posting Deadline"
              id="posting-deadline"
              type="date"
              value={formData.postingDeadline}
              onChange={(e) => setFormData({ ...formData, postingDeadline: e.target.value })}
              required
              error={fieldErrors.postingDeadline}
              fullWidth
              className="color-scheme-dark"
            />
          </div>

          {/* Physical product seeding */}
          <ProductSeedingCard formData={formData} setFormData={setFormData} />

          {/* Deliverables checklist */}
          <DeliverablesList formData={formData} setFormData={setFormData} />

          <div className="flex justify-end gap-3 mt-6">
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.back()}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={(e) => handleSubmit(e, true)}
              disabled={isLoading}
            >
              {isLoading ? <span className="loading" /> : "Save as Draft"}
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isLoading}
            >
              {publishButtonContent}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
