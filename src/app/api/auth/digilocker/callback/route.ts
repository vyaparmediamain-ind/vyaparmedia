import { apiWrapper } from "@/lib/api-wrapper";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { logger } from "@/lib/logger";
import { encrypt } from "@/lib/encryption";
import { auth } from "@/lib/auth";
import { appUrl, getConfiguredAppUrl } from "@/lib/app-url";

async function exchangeDigiLockerToken(code: string, codeVerifier: string, baseUrl: string) {
const tokenResponse = await fetch(
"https://accounts.digilocker.gov.in/oauth2/token",
{
method: "POST",
headers: {
"Content-Type": "application/x-www-form-urlencoded",
},
body: new URLSearchParams({
grant_type: "authorization_code",
code,
redirect_uri: `${baseUrl}/api/auth/digilocker/callback`,
client_id: process.env.DIGILOCKER_CLIENT_ID || "",
client_secret: process.env.DIGILOCKER_CLIENT_SECRET || "",
code_verifier: codeVerifier,
}),
}
);
return await tokenResponse.json();
}

const SUPPORTED_DOC_TYPES = new Set(["AADHAAR", "PAN"]);

async function processDigiLockerDoc(
  accessToken: string,
  userId: string,
  doc: { id: string; type: string; uri?: string; issuer?: string; issueDate?: string }
) {
  const docResponse = await fetch(
    `https://api.digilocker.gov.in/account/documents/${doc.id}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!docResponse.ok) {
    throw new Error(`Failed to fetch document: ${docResponse.statusText}`);
  }

  const docData = await docResponse.json();

  await prisma.verificationDocument.create({
    data: {
      userId,
      type: doc.type === "AADHAAR" ? "AADHAAR" : "PAN_CARD",
      documentUrl: docData.url || doc.uri,
      status: "VERIFIED",
      verifiedAt: new Date(),
      metadata: {
        source: "digilocker",
        documentId: doc.id,
        issuer: doc.issuer,
        issueDate: doc.issueDate,
      },
    },
  });

  logger.info("DigiLocker document fetched and stored", {
    userId,
    documentType: doc.type,
    documentId: doc.id,
  });
}

async function fetchAndStoreDigiLockerDocs(accessToken: string, userId: string) {
  try {
    const documentsResponse = await fetch(
      "https://api.digilocker.gov.in/account/documents",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!documentsResponse.ok) {
      throw new Error(`Failed to fetch document list: ${documentsResponse.statusText}`);
    }

    const documentsData = await documentsResponse.json();
    const docs: { id: string; type: string }[] = documentsData.documents ?? [];

    for (const doc of docs) {
      if (!SUPPORTED_DOC_TYPES.has(doc.type)) continue;
      try {
        await processDigiLockerDoc(accessToken, userId, doc);
      } catch (singleDocError) {
        logger.error("Failed to process specific DigiLocker document", {
          userId,
          documentType: doc.type,
          documentId: doc.id,
          error: singleDocError instanceof Error ? singleDocError.message : String(singleDocError),
        });
      }
    }
  } catch (docError) {
    logger.warn(
      "Failed to fetch documents from DigiLocker",
      docError instanceof Error ? { error: docError.message } : { error: String(docError) }
    );
  }
}


async function _handler_GET(req: NextRequest) {
const { searchParams } = new URL(req.url);
const code = searchParams.get("code");
const state = searchParams.get("state");
const error = searchParams.get("error");

const baseUrl = getConfiguredAppUrl(req.nextUrl.origin);

try {
if (error) {
logger.warn("DigiLocker OAuth error", { error });
return NextResponse.redirect(
appUrl("/dashboard/settings?tab=verification&error=digilocker_cancelled", req.nextUrl.origin)
);
}

if (!code || !state) {
return NextResponse.redirect(
appUrl("/dashboard/settings?tab=verification&error=invalid_request", req.nextUrl.origin)
);
}

const storedState = await prisma.oAuthState.findUnique({
where: { state },
});

if (storedState?.provider !== "digilocker") {
return NextResponse.redirect(
appUrl("/dashboard/settings?tab=verification&error=invalid_state", req.nextUrl.origin)
);
}

const session = await auth();
if (!session?.user?.id || session.user.id !== storedState.userId) {
await prisma.oAuthState.delete({ where: { state } }).catch(() => {});
logger.warn("DigiLocker OAuth state owner mismatch", {
stateUserId: storedState.userId,
sessionUserId: session?.user?.id,
});
return NextResponse.redirect(
appUrl("/dashboard/settings?tab=verification&error=invalid_session", req.nextUrl.origin)
);
}

if (new Date() > storedState.expiresAt) {
await prisma.oAuthState.delete({ where: { state } });
return NextResponse.redirect(
appUrl("/dashboard/settings?tab=verification&error=state_expired", req.nextUrl.origin)
);
}

const codeVerifier = req.cookies.get("digilocker_code_verifier")?.value;
if (!codeVerifier) {
return NextResponse.redirect(
appUrl("/dashboard/settings?tab=verification&error=code_verifier_missing", req.nextUrl.origin)
);
}

await prisma.oAuthState.delete({ where: { state } });

const tokenData = await exchangeDigiLockerToken(code, codeVerifier, baseUrl);
if (!tokenData.access_token) {
logger.error("DigiLocker token exchange failed", tokenData);
return NextResponse.redirect(
appUrl("/dashboard/settings?tab=verification&error=token_exchange_failed", req.nextUrl.origin)
);
}

const profileResponse = await fetch(
"https://api.digilocker.gov.in/account/profile",
{
headers: {
Authorization: `Bearer ${tokenData.access_token}`,
},
}
);
const profileData = await profileResponse.json();

if (!profileData.id) {
logger.error("DigiLocker profile missing required id field", { userId: storedState.userId, profileData });
return NextResponse.redirect(
appUrl("/dashboard/settings?tab=verification&error=invalid_digilocker_profile", req.nextUrl.origin)
);
}

await prisma.oAuthAccount.upsert({
where: {
provider_providerAccountId: {
provider: "digilocker",
providerAccountId: profileData.id,
},
},
create: {
userId: storedState.userId,
provider: "digilocker",
providerAccountId: profileData.id,
accessToken: encrypt(tokenData.access_token),
refreshToken: tokenData.refresh_token ? encrypt(tokenData.refresh_token) : null,
expiresAt: tokenData.expires_in
? new Date(Date.now() + tokenData.expires_in * 1000)
: null,
scope: tokenData.scope,
},
update: {
accessToken: encrypt(tokenData.access_token),
refreshToken: tokenData.refresh_token ? encrypt(tokenData.refresh_token) : null,
expiresAt: tokenData.expires_in
? new Date(Date.now() + tokenData.expires_in * 1000)
: null,
},
});

await fetchAndStoreDigiLockerDocs(tokenData.access_token, storedState.userId);

const response = NextResponse.redirect(
appUrl("/dashboard/settings?tab=verification&success=digilocker_connected", req.nextUrl.origin)
);
response.cookies.delete("digilocker_code_verifier");

return response;
} catch (error: unknown) {
logger.error("DigiLocker callback error", error);
return NextResponse.redirect(
appUrl("/dashboard/settings?tab=verification&error=digilocker_callback_failed", req.nextUrl.origin)
);
}
}

// Wrapped handlers via apiWrapper
export const GET = apiWrapper(_handler_GET);
