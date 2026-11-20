import { Suspense } from "react";
import { getDemoUsers } from "@/lib/auth";
import { LoginView } from "@/components/LoginView";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const demoUsers = await getDemoUsers();

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center text-sm text-slate-500">
          Loading demo accounts...
        </div>
      }
    >
      <LoginView demoUsers={demoUsers} />
    </Suspense>
  );
}
