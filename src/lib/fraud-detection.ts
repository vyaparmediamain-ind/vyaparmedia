export type { FraudCheckResult, FraudFlag } from "./fraud-detection/types";
export { checkRegistrationFraud } from "./fraud-detection/registration";
export { checkApplicationFraud } from "./fraud-detection/application";
export { checkPaymentFraud } from "./fraud-detection/payment";
export {
checkPostVerification,
checkGrowthFraud,
checkFakePostTiming,
checkEngagementAnomaly,
checkCommentQuality,
checkAccountPrivacyFlip,
checkContentUniqueness,
} from "./fraud-detection/social";
export { checkBlacklist } from "./fraud-detection/blacklist";
