"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, FileText, AlertCircle } from "lucide-react";
import type { UserSummary } from "@/lib/auth";
import { UserAvatar } from "@/components/UserAvatar";

interface LoginViewProps {
  demoUsers: UserSummary[];
}

const DEMO_HINTS: Record<string, string> = {
  "alice@ajaia.demo": "Owns 2 documents · Viewer on Bob's checklist",
  "bob@ajaia.demo": "Owns 1 document · Editor on Alice's Q4 Launch Plan",
  "charlie@ajaia.demo": "Fresh account · Great for testing sharing & 403 guards",
};

export function LoginView({ demoUsers }: LoginViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/";

  const [signingInEmail, setSigningInEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSignIn(email: string) {
    setSigningInEmail(email);
    setError(null);
    try {
      const res = await fetch("/api/auth/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Unable to sign in.");
        return;
      }

      const safeNext = nextPath.startsWith("/") ? nextPath : "/";
      router.push(safeNext);
      router.refresh();
    } catch {
      setError("Network error while signing in. Please try again.");
    } finally {
      setSigningInEmail(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
              <FileText className="h-4 w-4" />
            </span>
            <span className="text-base font-bold tracking-tight text-slate-900">
              Ajaia Docs
            </span>
          </div>
          <span className="text-xs text-slate-500">Demo Workspace Access</span>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 text-balance">
              Sign in to Ajaia Docs
            </h1>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              Choose a seeded demo account below to create, import, edit, and
              share documents. You can switch users anytime from the top bar.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-5 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-200 shadow-xs overflow-hidden">
            {demoUsers.map((user) => {
              const isLoading = signingInEmail === user.email;
              const hint = DEMO_HINTS[user.email];
              return (
                <button
                  key={user.id}
                  type="button"
                  disabled={Boolean(signingInEmail)}
                  onClick={() => handleSignIn(user.email)}
                  className="group flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none disabled:opacity-60"
                >
                  <UserAvatar
                    name={user.name}
                    color={user.avatarColor}
                    size="lg"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900">
                      {user.name}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">{user.email}</p>
                    {hint && (
                      <p className="text-xs text-slate-600 mt-1">{hint}</p>
                    )}
                  </div>
                  <div className="shrink-0 text-slate-400 group-hover:text-blue-600 transition-colors">
                    {isLoading ? (
                      <span className="text-xs font-medium text-blue-600">
                        Signing in...
                      </span>
                    ) : (
                      <ArrowRight className="h-4 w-4" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
