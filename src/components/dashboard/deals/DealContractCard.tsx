import { Card } from "@/components/ui";
import {
DealDetail,
parseContractTerms,
formatContractDate,
getIncludedRevisions,
} from "./DealDetailHelpers";

interface DealContractCardProps {
readonly deal: DealDetail;
}

export function DealContractCard({ deal }: Readonly<DealContractCardProps>) {
const contractTerms = parseContractTerms(deal.contractTerms);
const terms = contractTerms;
const requiresProduct = Boolean(deal.requiresProduct || terms?.requiresProduct);

return (
<Card className="card p-6">
<h3 className="font-bold text-lg mb-4">Contract Terms</h3>
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
<div>
<h4 className="font-semibold mb-2">Obligations & Deliverables</h4>
<div className="text-sm text-secondary">
{requiresProduct && (
<div className="mb-2">
<strong>Requires Product Seeding:</strong> Yes
</div>
)}
<div className="mb-2">
<strong>Included Revisions:</strong> {getIncludedRevisions(terms, deal)}
</div>
{terms?.mandatoryElements && (
<div className="mb-2">
<strong>Mandatory Elements:</strong> {Array.isArray(terms.mandatoryElements) ? terms.mandatoryElements.join(', ') : String(terms.mandatoryElements)}
</div>
)}
</div>
</div>

<div>
<h4 className="font-semibold mb-2">Timeline & Execution</h4>
<div className="text-sm text-secondary">
<div className="mb-2">
<strong>Submission Deadline:</strong> {formatContractDate(terms?.submissionDeadline)}
</div>
<div className="mb-2">
<strong>Posting Deadline:</strong> {formatContractDate(terms?.postingDeadline)}
</div>
<div className="mb-2">
<strong>Review Window:</strong> {typeof terms?.reviewPeriodHours === "number" ? terms.reviewPeriodHours : 48} hours
</div>
</div>
</div>
</div>
</Card>
);
}
