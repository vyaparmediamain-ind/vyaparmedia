import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { renderResultHtml } from "@/lib/html-template";
import { BlogSubscriber } from "@prisma/client";

export async function validateBlogToken(
req: NextRequest,
failTitle: string
): Promise<{ subscriber: BlogSubscriber; response?: never } | { subscriber?: never; response: NextResponse }> {
const { searchParams } = new URL(req.url);
const token = searchParams.get("token");

if (!token) {
return {
response: new NextResponse(
renderResultHtml(
failTitle,
failTitle,
`Invalid or missing ${failTitle.toLowerCase().includes("unsubscribe") ? "unsubscribe" : "verification"} token.`,
false
),
{ headers: { "Content-Type": "text/html" } }
)
};
}

const subscriber = await prisma.blogSubscriber.findUnique({
where: { unsubscribeToken: token },
});

if (!subscriber) {
return {
response: new NextResponse(
renderResultHtml(
failTitle,
failTitle,
`This ${failTitle.toLowerCase().includes("unsubscribe") ? "unsubscribe" : "verification"} link is invalid or has expired.`,
false
),
{ headers: { "Content-Type": "text/html" } }
)
};
}

return { subscriber };
}
