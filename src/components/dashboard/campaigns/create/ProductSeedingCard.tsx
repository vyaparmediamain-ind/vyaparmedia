"use client";

import React from "react";
import { Card, Input, Textarea } from "@/components/ui";
import { CampaignFormData } from "./CampaignCreateHelpers";
import { Package, Truck } from "lucide-react";

interface ProductSeedingCardProps {
  readonly formData: CampaignFormData;
  readonly setFormData: React.Dispatch<React.SetStateAction<CampaignFormData>>;
}

export function ProductSeedingCard({
  formData,
  setFormData,
}: ProductSeedingCardProps) {
  return (
    <Card className="p-5 rounded-2xl border border-border bg-card shadow-xs space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-foreground">
              Product Seeding & Physical Gifting
            </h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              Do you need to ship physical merchandise or review units to influencers?
            </p>
          </div>
        </div>

        {/* Clean Toggle Switch */}
        <label
          htmlFor="product-seeding-toggle"
          className="relative inline-flex items-center cursor-pointer shrink-0"
        >
          <input
            id="product-seeding-toggle"
            type="checkbox"
            checked={formData.requiresProduct}
            onChange={(e) =>
              setFormData({ ...formData, requiresProduct: e.target.checked })
            }
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-background after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-background after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
          <span className="sr-only">Requires physical product seeding</span>
        </label>
      </div>

      {formData.requiresProduct && (
        <div className="pt-4 border-t border-border space-y-4 animate-in fade-in-50 duration-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Product Name"
              id="product-name"
              type="text"
              value={formData.productName}
              onChange={(e) =>
                setFormData({ ...formData, productName: e.target.value })
              }
              required={formData.requiresProduct}
              placeholder="e.g. Glowing Skin Vitamin C Serum (50ml)"
              fullWidth
            />
            <Input
              label="Product Retail Value (₹)"
              id="product-value"
              type="number"
              value={formData.productValue || ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  productValue: Number.parseInt(e.target.value, 10) || 0,
                })
              }
              min={0}
              placeholder="e.g. 1499"
              fullWidth
            />
          </div>

          <Textarea
            label="Logistics & Shipping Instructions"
            id="product-description"
            value={formData.productDescription}
            onChange={(e) =>
              setFormData({ ...formData, productDescription: e.target.value })
            }
            placeholder="Specify dispatch timeline, whether creators keep the product, or delivery address requirements..."
            fullWidth
            rows={2}
          />

          <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/60 text-xs text-muted-foreground border border-border">
            <Truck className="w-4 h-4 text-primary shrink-0" />
            <span>
              Creators will provide their shipping address confidentially in their deal room once hired.
            </span>
          </div>
        </div>
      )}
    </Card>
  );
}
