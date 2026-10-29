import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { apiWrapper } from "@/lib/api-wrapper";
import { MessageService } from "@/services/message.service";

export const GET = apiWrapper(async (req) => {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ canMessage: false }, { status: 200 });
  }

  const { searchParams } = new URL(req.url);
  const targetUserId = searchParams.get("with")?.trim();
  if (!targetUserId) {
    return NextResponse.json({ canMessage: false }, { status: 200 });
  }

  const canMessage = await MessageService.canMessageUser(session.user.id, targetUserId);
  return NextResponse.json({ canMessage });
});
