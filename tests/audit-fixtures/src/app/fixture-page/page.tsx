import { requireActiveAdmin } from "@/lib/admin-auth";

export default async function FixturePage() {
  await requireActiveAdmin({ id: "admin-1", email: "admin@test.com", userType: "ADMIN" });
  return <div>Admin Fixture Page</div>;
}
