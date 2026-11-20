"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Trash2, UserPlus, X } from "lucide-react";
import type { UserSummary } from "@/lib/auth";
import type { DocumentShareItem, ShareRole } from "@/lib/documents";
import { UserAvatar } from "@/components/UserAvatar";

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: string;
  documentTitle: string;
  ownerId: string;
  demoUsers: UserSummary[];
  initialShares?: DocumentShareItem[];
  onSharesChanged?: (shares: DocumentShareItem[]) => void;
}

export function ShareModal({
  isOpen,
  onClose,
  documentId,
  documentTitle,
  ownerId,
  demoUsers,
  initialShares,
  onSharesChanged,
}: ShareModalProps) {
  const availableUsers = demoUsers.filter((u) => u.id !== ownerId);

  const [shares, setShares] = useState<DocumentShareItem[]>(
    initialShares ?? []
  );
  const [loadingShares, setLoadingShares] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<string>(
    availableUsers[0]?.email ?? ""
  );
  const [selectedRole, setSelectedRole] = useState<ShareRole>("EDITOR");
  const [submitting, setSubmitting] = useState(false);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setFeedback(null);

    if (initialShares) {
      setShares(initialShares);
    }

    let cancelled = false;
    async function loadLatestShares() {
      setLoadingShares(true);
      try {
        const res = await fetch(`/api/documents/${documentId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data.shares)) {
          setShares(data.shares);
          onSharesChanged?.(data.shares);
        }
      } finally {
        if (!cancelled) setLoadingShares(false);
      }
    }

    loadLatestShares();
    return () => {
      cancelled = true;
    };
  }, [isOpen, documentId]);

  useEffect(() => {
    if (!selectedEmail && availableUsers.length > 0) {
      setSelectedEmail(availableUsers[0].email);
    }
  }, [availableUsers, selectedEmail]);

  if (!isOpen) return null;

  async function handleShareSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedEmail) {
      setFeedback({ type: "error", message: "Select a collaborator to share with." });
      return;
    }

    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/documents/${documentId}/shares`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: selectedEmail,
          role: selectedRole,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFeedback({
          type: "error",
          message: data.error || "Unable to share document.",
        });
        return;
      }

      setShares(data.shares);
      onSharesChanged?.(data.shares);
      setFeedback({
        type: "success",
        message: `Shared with ${data.share.name} as ${
          data.share.role === "EDITOR" ? "Editor" : "Viewer"
        }.`,
      });
    } catch {
      setFeedback({
        type: "error",
        message: "Network error while updating access.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemove(userId: string, name: string) {
    setRemovingUserId(userId);
    setFeedback(null);
    try {
      const res = await fetch(`/api/documents/${documentId}/shares/${userId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({
          type: "error",
          message: data.error || "Failed to remove collaborator.",
        });
        return;
      }

      const nextShares = shares.filter((s) => s.userId !== userId);
      setShares(nextShares);
      onSharesChanged?.(nextShares);
      setFeedback({
        type: "success",
        message: `Removed access for ${name}.`,
      });
    } catch {
      setFeedback({
        type: "error",
        message: "Network error while revoking access.",
      });
    } finally {
      setRemovingUserId(null);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[1px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="min-w-0 pr-4">
            <h2
              id="share-modal-title"
              className="text-base font-semibold text-slate-900 truncate"
            >
              Share &ldquo;{documentTitle}&rdquo;
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Grant Editor or Viewer permissions to workspace members
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close share dialog"
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <form onSubmit={handleShareSubmit} className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="flex-1">
                <label
                  htmlFor="share-user-select"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Person
                </label>
                <select
                  id="share-user-select"
                  value={selectedEmail}
                  onChange={(e) => setSelectedEmail(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/15"
                >
                  {availableUsers.map((user) => (
                    <option key={user.id} value={user.email}>
                      {user.name} ({user.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:w-32">
                <label
                  htmlFor="share-role-select"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Access
                </label>
                <select
                  id="share-role-select"
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as ShareRole)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/15"
                >
                  <option value="EDITOR">Editor</option>
                  <option value="VIEWER">Viewer</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submitting || availableUsers.length === 0}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                <UserPlus className="h-4 w-4" />
                <span>{submitting ? "Sharing..." : "Share"}</span>
              </button>
            </div>
          </form>

          {feedback && (
            <div
              role="status"
              className={`flex items-start gap-2 rounded-lg border px-3.5 py-2.5 text-sm ${
                feedback.type === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-red-200 bg-red-50 text-red-700"
              }`}
            >
              {feedback.type === "success" ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              ) : (
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
              )}
              <span>{feedback.message}</span>
            </div>
          )}

          <div className="border-t border-slate-200 pt-4">
            <h3 className="text-xs font-semibold text-slate-700 mb-3">
              People with access ({shares.length})
            </h3>

            {loadingShares && shares.length === 0 ? (
              <p className="text-sm text-slate-500 py-2">Loading access list...</p>
            ) : shares.length === 0 ? (
              <p className="text-sm text-slate-500 py-2">
                Only you have access to this document right now.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {shares.map((share) => (
                  <li
                    key={share.userId}
                    className="flex items-center justify-between gap-3 py-2.5"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <UserAvatar
                        name={share.name}
                        color={share.avatarColor}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {share.name}
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                          {share.email}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs font-medium text-slate-600">
                        {share.role === "EDITOR" ? "Editor" : "Viewer"}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemove(share.userId, share.name)}
                        disabled={removingUserId === share.userId}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>
                          {removingUserId === share.userId
                            ? "Removing..."
                            : "Remove"}
                        </span>
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="flex justify-end border-t border-slate-200 px-6 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
