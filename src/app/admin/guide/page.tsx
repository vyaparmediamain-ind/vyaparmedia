import React from "react";
import { GuideCenterClient } from "@/app/dashboard/guide/GuideCenterClient";
import { ALL_GUIDES } from "@/content/guides";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin Guide Center & SOPs | VyaparMedia",
  description: "Administrative standard operating procedures, compliance rules, and operations runbooks.",
};

export default async function AdminGuidePage() {
  return (
    <GuideCenterClient
      userRole="ADMIN"
      isAdminView={true}
      disabledFeatureFlags={[]}
      initialGuides={ALL_GUIDES}
    />
  );
}
