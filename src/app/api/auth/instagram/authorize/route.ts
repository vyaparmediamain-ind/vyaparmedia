import { apiWrapper } from "@/lib/api-wrapper";
import { NextRequest } from "next/server";
import { getInstagramOAuthUrl } from "@/lib/instagram";
import { initiateOAuthFlow } from "@/lib/oauth-helper";

async function _handler_GET(req: NextRequest) {
return initiateOAuthFlow(req, "instagram", (state, redirectUri) =>
getInstagramOAuthUrl(redirectUri, state),
);
}

// Wrapped handlers via apiWrapper
export const GET = apiWrapper(_handler_GET);
