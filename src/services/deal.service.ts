import { listDeals } from "./deal/list";
import { rejectPendingInvite } from "./deal/invite";
import { submitContent, approveContent, reviewContent } from "./deal/content";
import { submitShippingAddress, confirmProductDispatch, confirmProductReceived } from "./deal/product";
import { autoApproveExpiredContent } from "./deal/auto-approve";
import { verifyPost } from "./deal/verify";

export type { DealWithRelations, ExpiredDealCandidate } from "./deal/helpers";

export class DealService {
static readonly listDeals = listDeals;
static readonly submitContent = submitContent;
static readonly rejectPendingInvite = rejectPendingInvite;
static readonly submitShippingAddress = submitShippingAddress;
static readonly confirmProductDispatch = confirmProductDispatch;
static readonly confirmProductReceived = confirmProductReceived;
static readonly approveContent = approveContent;
static readonly reviewContent = reviewContent;
static readonly autoApproveExpiredContent = autoApproveExpiredContent;
static readonly verifyPost = verifyPost;
}
