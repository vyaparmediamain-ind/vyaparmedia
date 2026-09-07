import { FraudCheckResult } from "./types";

export function resolveFraudAction(riskScore: number): FraudCheckResult["action"] {
if (riskScore >= 60) return "BLOCK";
if (riskScore >= 35) return "REVIEW";
if (riskScore >= 15) return "FLAG";
return "ALLOW";
}
