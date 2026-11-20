import { redirect } from "next/navigation";
import { getCurrentUser, getDemoUsers } from "@/lib/auth";
import { listDocumentsForUser } from "@/lib/documents";
import { DashboardClient } from "@/components/DashboardClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const [demoUsers, { owned, sharedWithMe }] = await Promise.all([
    getDemoUsers(),
    listDocumentsForUser(user.id),
  ]);

  return (
    <DashboardClient
      key={user.id}
      currentUser={user}
      demoUsers={demoUsers}
      initialOwned={owned}
      initialSharedWithMe={sharedWithMe}
    />
  );
}
