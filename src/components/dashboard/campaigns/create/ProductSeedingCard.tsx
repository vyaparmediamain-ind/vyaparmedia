"use client";

import { Card, Input, Textarea } from "@/components/ui";
import { CampaignFormData } from "./CampaignCreateHelpers";

interface ProductSeedingCardProps {
readonly formData: CampaignFormData;
readonly setFormData: React.Dispatch<React.SetStateAction<CampaignFormData>>;
}

export function ProductSeedingCard({
formData,
setFormData,
}: ProductSeedingCardProps) {
return (
<Card
className="mb-4 p-5 bg-tertiary border-dashed"
>
<div
className={`flex items-center justify-between ${formData.requiresProduct ? "mb-4" : "mb-0"}`}
>
<div>
<h3
className="text-base font-semibold text-primary"
>
Product Seeding (Barter / Logistics)
</h3>
<p
className="text-secondary text-sm mt-1"
>
Do you need to ship a physical product to the influencer?
</p>
</div>
<label className="switch" aria-label="Requires physical product seeding">
<input
type="checkbox"
checked={formData.requiresProduct}
onChange={(e) =>
setFormData({ ...formData, requiresProduct: e.target.checked })
}
/>
<span className="slider round"></span>
<span className="sr-only">Requires physical product seeding</span>
</label>
</div>

{formData.requiresProduct && (
<div className="mt-4">
<div className="grid-2 gap-4 mb-3">
<Input
label="Product Name"
id="product-name"
type="text"
value={formData.productName}
onChange={(e) =>
setFormData({ ...formData, productName: e.target.value })
}
required={formData.requiresProduct}
placeholder="e.g. Glowing Skin Serum 50ml"
fullWidth
/>
<Input
label="Product Value (Rs)"
id="product-value"
type="number"
value={formData.productValue}
onChange={(e) =>
setFormData({
...formData,
productValue: Number.parseInt(e.target.value, 10) || 0,
})
}
min={0}
placeholder="e.g. 1500"
fullWidth
/>
</div>
<Textarea
label="Logistics / Shipping Instructions"
id="product-description"
value={formData.productDescription}
onChange={(e) =>
setFormData({ ...formData, productDescription: e.target.value })
}
placeholder="Provide any details about the product and shipping timelines..."
fullWidth
/>
</div>
)}
</Card>
);
}
