import { NextRequest, NextResponse } from "next/server";
import { apiWrapper } from "@/lib/api-wrapper";
import prisma from "@/lib/db";
import { renderResultHtml } from "@/lib/html-template";
import { validateBlogToken } from "@/lib/blog-subscriber-helper";

export const GET = apiWrapper(async (req: NextRequest) => {
const result = await validateBlogToken(req, "Verification Failed");
if (result.response) return result.response;

await prisma.blogSubscriber.update({
where: { id: result.subscriber.id },
data: { verified: true },
});

return new NextResponse(
renderResultHtml(
"Subscription Confirmed",
"Subscription Confirmed!",
"Thank you! Your subscription to the VyaparMedia Blog is verified.",
true,
),
{ headers: { "Content-Type": "text/html" } },
);
});
