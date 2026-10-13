"use client";

import React from "react";
import { Button, Input, Select } from "@/components/ui";
import { formatCurrency } from "@/lib/utils-client";
import {
  CampaignFormData,
  deliverableTypes,
  getRecommendedRate,
} from "./CampaignCreateHelpers";
import { Camera, Video, Plus, Trash2, Sparkles } from "lucide-react";

interface DeliverablesListProps {
  readonly formData: CampaignFormData;
  readonly setFormData: React.Dispatch<React.SetStateAction<CampaignFormData>>;
}

export function DeliverablesList({
  formData,
  setFormData,
}: DeliverablesListProps) {
  const handleDeliverableChange = (
    index: number,
    field: string,
    value: unknown,
  ) => {
    const newDeliverables = [...formData.deliverables] as Array<{
      type: string;
      rate: number;
      count: number;
    }>;
    const item = { ...newDeliverables[index]!, [field]: value };

    // Automatically recalculate recommended rate if type changes
    if (field === "type" && typeof value === "string") {
      item.rate = getRecommendedRate(value, formData.minFollowers);
    }

    newDeliverables[index] = item;
    setFormData((prev) => ({ ...prev, deliverables: newDeliverables }));
  };

  const handleAddDeliverable = () => {
    setFormData((prev) => {
      const type = "INSTAGRAM_POST";
      const count = 1;
      const rate = getRecommendedRate(type, prev.minFollowers);
      return {
        ...prev,
        deliverables: [...prev.deliverables, { type, count, rate }],
      };
    });
  };

  const handleRemoveDeliverable = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      deliverables: prev.deliverables.filter((_, i) => i !== index),
    }));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <label className="text-sm font-bold text-foreground block">
            Deliverables & Milestone Rates
          </label>
          <p className="text-xs text-muted-foreground">
            Specify the content deliverables creators will submit for milestone escrow approval.
          </p>
        </div>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handleAddDeliverable}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:bg-primary/10 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Deliverable</span>
        </Button>
      </div>

      <div className="space-y-3">
        {formData.deliverables.map((item, index) => {
          const isYoutube = item.type.startsWith("YOUTUBE");
          const recommendedRate = getRecommendedRate(item.type, formData.minFollowers);

          return (
            <div
              key={`deliv-${item.type}-${index}`}
              className="p-4 rounded-2xl border border-border bg-card shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center gap-3 transition-colors hover:border-primary/40"
            >
              {/* Platform Visual Badge */}
              <div className="flex items-center gap-2 sm:w-48 shrink-0">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    isYoutube
                      ? "bg-disputed-muted text-disputed"
                      : "bg-pink-500/10 text-pink-600 dark:bg-pink-500/15 dark:text-pink-400"
                  }`}
                >
                  {isYoutube ? (
                    <Video className="w-4 h-4" />
                  ) : (
                    <Camera className="w-4 h-4" />
                  )}
                </div>

                <Select
                  id={`deliverable-type-${index}`}
                  name={`deliverable-type-${index}`}
                  value={item.type}
                  onChange={(e) =>
                    handleDeliverableChange(index, "type", e.target.value)
                  }
                  className="w-full text-xs font-bold"
                  aria-label="Deliverable Type"
                >
                  {deliverableTypes.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </Select>
              </div>

              {/* Quantity Selector */}
              <div className="flex items-center gap-1.5 shrink-0 sm:w-28">
                <Input
                  id={`deliverable-qty-${index}`}
                  name={`deliverable-qty-${index}`}
                  type="number"
                  value={item.count}
                  onChange={(e) =>
                    handleDeliverableChange(
                      index,
                      "count",
                      Number.parseInt(e.target.value, 10) || 1,
                    )
                  }
                  min={1}
                  max={10}
                  className="w-16 text-center tabular-nums font-bold text-xs"
                  aria-label="Quantity"
                />
                <span className="text-xs text-muted-foreground font-medium">
                  qty
                </span>
              </div>

              {/* Rate per Deliverable */}
              <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-2">
                <div className="relative flex-1">
                  <Input
                    id={`deliverable-rate-${index}`}
                    name={`deliverable-rate-${index}`}
                    type="number"
                    value={item.rate || ""}
                    onChange={(e) =>
                      handleDeliverableChange(
                        index,
                        "rate",
                        Number.parseInt(e.target.value, 10) || 0,
                      )
                    }
                    min={0}
                    placeholder="Rate in ₹"
                    className="tabular-nums font-bold text-xs"
                    aria-label="Rate in Rupees"
                  />
                </div>

                <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted text-[11px] text-muted-foreground shrink-0">
                  <Sparkles className="w-3 h-3 text-primary" />
                  <span>Rec:</span>
                  <strong className="text-foreground tabular-nums">
                    {formatCurrency(recommendedRate * 100)}
                  </strong>
                </div>
              </div>

              {/* Remove Deliverable Trigger */}
              {formData.deliverables.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveDeliverable(index)}
                  className="p-2 text-destructive hover:bg-destructive/10 rounded-xl transition-colors shrink-0 self-end sm:self-center"
                  aria-label="Remove Deliverable"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
