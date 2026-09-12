import { Card } from "@/components/ui";
import {
DealDetail,
parseContractTerms,
formatContractDate,
getIncludedRevisions,
} from "./DealDetailHelpers";

interface DealContractCardProps {
  readonly deal: DealDetail;
  readonly onOpenAddressModal?: () => void;
}

export function DealContractCard({ deal, onOpenAddressModal }: Readonly<DealContractCardProps>) {
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

      <div className="mt-6 pt-4 border-t border-border">
        <h4 className="font-semibold mb-3">Digital Signatures</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="p-3 rounded-lg border border-border bg-card/40 flex flex-col gap-1">
            <span className="text-xs text-secondary font-medium">Brand Signature ({deal.brand?.companyName || "Brand"})</span>
            {deal.brandSignedAt ? (
              <span className="text-emerald-600 font-semibold flex items-center gap-1.5">
                <span>✓</span> Signed on {formatContractDate(deal.brandSignedAt)}
              </span>
            ) : (
              <span className="text-amber-500 font-medium flex items-center gap-1.5">
                <span>⏳</span> Pending Signature
              </span>
            )}
          </div>
          <div className="p-3 rounded-lg border border-border bg-card/40 flex flex-col gap-1">
            <span className="text-xs text-secondary font-medium">Creator Signature ({deal.influencer?.displayName || "Influencer"})</span>
            {deal.influencerSignedAt ? (
              <span className="text-emerald-600 font-semibold flex items-center gap-1.5">
                <span>✓</span> Signed on {formatContractDate(deal.influencerSignedAt)}
              </span>
            ) : (
              <span className="text-amber-500 font-medium flex items-center gap-1.5">
                <span>⏳</span> Pending Signature
              </span>
            )}
          </div>
        </div>
      </div>

      {requiresProduct && (
        <div className="mt-4 pt-4 border-t border-border flex items-center justify-between flex-wrap gap-2">
          <div className="text-sm">
            <strong>Product Seeding:</strong>{" "}
            <span className="text-secondary">
              {deal.productFulfillmentStatus?.replaceAll("_", " ") || "ADDRESS PENDING"}
            </span>
          </div>
          {onOpenAddressModal && (
            <button
              type="button"
              onClick={onOpenAddressModal}
              className="text-xs text-primary underline hover:opacity-80 font-medium cursor-pointer"
            >
              📦 View / Provide Shipping Address
            </button>
          )}
        </div>
      )}
    </Card>
  );
}
