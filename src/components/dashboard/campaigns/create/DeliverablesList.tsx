"use client";

import { Button, Input, Select } from "@/components/ui";
import {
CampaignFormData,
deliverableTypes,
getRecommendedRate,
} from "./CampaignCreateHelpers";

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
const newDeliverables = [...formData.deliverables] as Array<{ type: string; rate: number; count: number }>;
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
deliverables: [
...prev.deliverables,
{ type, count, rate },
],
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
<div className="form-group mb-4">
<div className="flex justify-between items-center mb-2">
<div className="label">Deliverables Required</div>
<Button
type="button"
variant="ghost"
onClick={handleAddDeliverable}
className="text-sm font-semibold px-2 py-1"
>
+ Add Deliverable
</Button>
</div>

{formData.deliverables.map((item, index) => (
<div
key={`deliv-${item.type}-${index}`}
className="flex flex-wrap sm:flex-nowrap gap-2.5 sm:gap-3 items-center mb-4 sm:mb-2 pb-3 sm:pb-0 border-b border-card sm:border-none w-full"
>
<Select
id={`deliverable-type-${index}`}
name={`deliverable-type-${index}`}
value={item.type}
onChange={(e) =>
handleDeliverableChange(index, "type", e.target.value)
}
className="flex-2"
>
{deliverableTypes.map((t) => (
<option key={t.value} value={t.value}>
{t.label}
</option>
))}
</Select>

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
className="w-80"
aria-label="Quantity"
/>

<span className="text-secondary text-sm">
qty
</span>

<div className="flex flex-col gap-1">
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
placeholder="Rate (Rs)"
className="w-110"
aria-label="Rate in Rupees"
/>
<span className="text-muted whitespace-nowrap text-2xs">
Rec: ₹{getRecommendedRate(item.type, formData.minFollowers).toLocaleString("en-IN")}
</span>
</div>

{formData.deliverables.length > 1 && (
<Button
type="button"
variant="ghost"
onClick={() => handleRemoveDeliverable(index)}
className="text-lg text-rose deliverable-remove-btn"
>
x
</Button>
)}
</div>
))}
</div>
);
}
