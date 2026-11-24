import React from "react";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { GuideCenterClient } from "./GuideCenterClient";
import type { GuideUserType } from "@/lib/guides/schema";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Guide Center | VyaparMedia",
  description: "Official interactive platform guides, escrow workflows, and statutory compliance documentation.",
};

export default async function DashboardGuidePage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/dashboard/guide");
  }

  const rawRole = (session.user.userType || "INFLUENCER").toUpperCase();
  const validRoles: GuideUserType[] = ["INFLUENCER", "BRAND", "SCOUT", "ADMIN"];
  const userRole: GuideUserType = validRoles.includes(rawRole as GuideUserType)
    ? (rawRole as GuideUserType)
    : "INFLUENCER";

  return <GuideCenterClient userRole={userRole} />;
}
