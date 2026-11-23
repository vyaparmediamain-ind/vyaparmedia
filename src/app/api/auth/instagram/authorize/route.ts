import { apiWrapper } from "@/lib/api-wrapper";
import { NextRequest } from "next/server";
import { getInstagramOAuthUrl } from "@/lib/instagram";
import { initiateOAuthFlow } from "@/lib/oauth-helper";
import { auth } from "@/lib/auth";
import { isFeatureEnabled, FEATURE_FLAGS } from "@/lib/feature-flags";

async function _handler_GET(req: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  const role = session?.user?.userType;
  const requestInsights = await isFeatureEnabled(FEATURE_FLAGS.INSTAGRAM_INSIGHTS, {
    userId,
    role,
  });

  return initiateOAuthFlow(req, "instagram", (state, redirectUri) =>
    getInstagramOAuthUrl(redirectUri, state, { requestInsights }),
  );
}

// Wrapped handlers via apiWrapper
export const GET = apiWrapper(_handler_GET);
