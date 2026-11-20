"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, LogOut } from "lucide-react";
import type { UserSummary } from "@/lib/auth";
import { UserAvatar } from "@/components/UserAvatar";

interface DemoUserSwitcherProps {
  currentUser: UserSummary;
  demoUsers: UserSummary[];
  onBeforeSwitch?: (targetEmail: string) => boolean;
  onSwitched?: (user: UserSummary) => void;
}

export function DemoUserSwitcher({
  currentUser,
  demoUsers,
  onBeforeSwitch,
  onSwitched,
}: DemoUserSwitcherProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [switchingEmail, setSwitchingEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener("mousedown", handleOutsideClick);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  async function handleSwitch(email: string) {
    if (email === currentUser.email) {
      setOpen(false);
      return;
    }

    if (onBeforeSwitch && !onBeforeSwitch(email)) {
      setOpen(false);
      return;
    }

    setSwitchingEmail(email);
    setError(null);
    try {
      const res = await fetch("/api/auth/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to switch user");
        return;
      }

      setOpen(false);
      if (onSwitched) {
        onSwitched(data.user);
      }
      router.refresh();
    } catch {
      setError("Network error while switching account");
    } finally {
      setSwitchingEmail(null);
    }
  }

  async function handleSignOut() {
    if (onBeforeSwitch && !onBeforeSwitch("__logout__")) {
      setOpen(false);
      return;
    }

    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setOpen(false);
      router.push("/login");
      router.refresh();
    } catch {
      setError("Unable to sign out");
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-left transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
      >
        <UserAvatar
          name={currentUser.name}
          color={currentUser.avatarColor}
          size="sm"
        />
        <div className="hidden sm:flex flex-col leading-tight min-w-0">
          <span className="text-xs font-semibold text-slate-900 truncate max-w-[130px]">
            {currentUser.name}
          </span>
          <span className="text-[11px] text-slate-500 truncate max-w-[140px]">
            {currentUser.email}
          </span>
        </div>
        <ChevronDown
          className={`h-3.5 w-3.5 text-slate-500 transition-transform duration-150 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-72 rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg z-50"
        >
          <div className="px-3.5 py-2 border-b border-slate-100">
            <p className="text-xs font-semibold text-slate-900">
              Switch Demo User
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Test ownership and sharing permissions in one click
            </p>
          </div>

          {error && (
            <div className="mx-3 my-2 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-700">
              {error}
            </div>
          )}

          <div className="py-1">
            {demoUsers.map((user) => {
              const isActive = user.email === currentUser.email;
              const isLoading = switchingEmail === user.email;
              return (
                <button
                  key={user.id}
                  type="button"
                  role="menuitem"
                  disabled={Boolean(switchingEmail)}
                  onClick={() => handleSwitch(user.email)}
                  className={`flex w-full items-center gap-3 px-3.5 py-2 text-left transition-colors ${
                    isActive
                      ? "bg-blue-50/70 text-slate-900"
                      : "text-slate-700 hover:bg-slate-50"
                  } disabled:opacity-60`}
                >
                  <UserAvatar
                    name={user.name}
                    color={user.avatarColor}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {user.name}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {user.email}
                    </p>
                  </div>
                  {isLoading ? (
                    <span className="text-xs text-blue-600 font-medium">
                      Switching...
                    </span>
                  ) : isActive ? (
                    <Check className="h-4 w-4 shrink-0 text-blue-600" />
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="border-t border-slate-100 pt-1">
            <button
              type="button"
              role="menuitem"
              onClick={handleSignOut}
              className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sign out to login screen</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
