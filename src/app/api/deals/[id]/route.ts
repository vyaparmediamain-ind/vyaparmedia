import { apiWrapper } from "@/lib/api-wrapper";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { cache } from "@/lib/cache";
import { NextResponse } from "next/server";
import { routeParamsSchema } from "@/lib/validations";
import { getDealParticipantRole } from "@/lib/utils";
import { isAdmin } from "@/lib/rbac";
import { requireActiveAdmin } from "@/lib/admin-auth";

const paramsSchema = routeParamsSchema;

export const GET = apiWrapper(
  async (_request, { params }) => {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resolvedParams = (await params) as { id: string };
    const parsedParams = paramsSchema.safeParse(resolvedParams);
    if (!parsedParams.success) {
      return NextResponse.json({ error: "Invalid deal ID" }, { status: 400 });
    }
    const { id } = parsedParams.data;

    // Cache individual deal for 5 minutes (300 seconds)
    // Note: Deal updates should invalidate this key: `deal:${id}`
    const deal = await cache(
      `deal:${id}`,
      async () => {
        return await prisma.deal.findUnique({
          where: { id },
          include: {
            campaign: {
              select: {
                id: true,
                title: true,
                requirements: true,
                guidelines: true,
                deliverables: true,
                postingDeadline: true,
              },
            },
            brand: {
              select: {
                id: true,
                companyName: true,
                logo: true,
                userId: true,
                isGstVerified: true,
                averageRating: true,
              },
            },
            influencer: {
              select: {
                id: true,
                displayName: true,
                avatar: true,
                userId: true,
                instagramHandle: true,
                averageRating: true,
              },
            },
            contentSubmissions: {
              orderBy: { version: "desc" },
            },
          },
        });
      },
      300,
    );

    if (!deal) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    // Verify access: admins can inspect any deal; participants can only view their own.
    const { isInfluencer, isBrand } = getDealParticipantRole(deal, session.user.id);

    if (isAdmin(session.user.userType)) {
      try {
        await requireActiveAdmin(session.user);
      } catch {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }
    } else if (!isInfluencer && !isBrand) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    return NextResponse.json({ deal });
  },
  { rateLimit: { limit: 120, window: 60 } },
);
