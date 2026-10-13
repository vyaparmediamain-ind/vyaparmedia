import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { apiWrapper } from "@/lib/api-wrapper";
import { ReviewService } from "@/services/review.service";
import { reviewSchema } from "@/lib/validations";
import { checkRateLimit } from "@/lib/rate-limit";
import { parsePagination } from "@/lib/utils";

export const GET = apiWrapper(async (req) => {
const session = await auth();
if (!session?.user?.id) {
return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

const { searchParams } = new URL(req.url);
const targetUserId = searchParams.get("userId")?.trim() || undefined; // If looking at someone else's reviews
const { page, limit } = parsePagination(searchParams);

const result = await ReviewService.listReviews(
session.user.id,
targetUserId,
page,
limit,
);

return NextResponse.json({
reviews: result.reviews,
pagination: {
page,
limit,
total: result.total,
totalPages: Math.ceil(result.total / (limit || 1)),
},
});
});

export const POST = apiWrapper(async (req) => {
const session = await auth();
if (!session?.user?.id) {
return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

const limitCheck = await checkRateLimit(session.user.id, "REVIEWS");
if (!limitCheck.success) {
return NextResponse.json(
{ error: "Rate limit exceeded for reviews", reset: limitCheck.reset },
{ status: 429 },
);
}

const body = await req.json();
const parsed = reviewSchema.parse(body);

const review = await ReviewService.createReview(session.user.id, {
dealId: parsed.dealId,
rating: parsed.rating,
...(parsed.comment ? { comment: parsed.comment } : {}),
...(parsed.receiverId ? { receiverId: parsed.receiverId } : {}),
});

return NextResponse.json({
success: true,
review,
message: "Review submitted successfully",
});
});
