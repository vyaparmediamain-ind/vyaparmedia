import { apiWrapper } from "@/lib/api-wrapper";
import { NextRequest } from "next/server";
import { getYouTubeOAuthUrl } from "@/lib/youtube";
import { initiateOAuthFlow } from "@/lib/oauth-helper";

async function _handler_GET(req: NextRequest) {
return initiateOAuthFlow(req, "youtube", (state, redirectUri) =>
getYouTubeOAuthUrl(redirectUri, state),
);
}

// Wrapped handlers via apiWrapper
export const GET = apiWrapper(_handler_GET);
