import { NextRequest, NextResponse } from "next/server";
import { apiWrapper } from "@/lib/api-wrapper";
import prisma from "@/lib/db";
import { renderResultHtml } from "@/lib/html-template";
import { validateBlogToken } from "@/lib/blog-subscriber-helper";

export const GET = apiWrapper(async (req: NextRequest) => {
const result = await validateBlogToken(req, "Unsubscribe Failed");
if (result.response) return result.response;

await prisma.blogSubscriber.delete({
where: { id: result.subscriber.id },
});

return new NextResponse(
renderResultHtml(
"Unsubscribed Successfully",
"Unsubscribed",
"You have been successfully unsubscribed from the VyaparMedia Blog.",
true,
),
{ headers: { "Content-Type": "text/html" } },
);
});
