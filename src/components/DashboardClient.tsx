"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  FilePlus2,
  FileText,
  Pencil,
  Share2,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";
import type { UserSummary } from "@/lib/auth";
import type { DocumentSummary } from "@/lib/documents";
import { DemoUserSwitcher } from "@/components/DemoUserSwitcher";
import { ImportFileModal } from "@/components/ImportFileModal";
import { ShareModal } from "@/components/ShareModal";

interface DashboardClientProps {
  currentUser: UserSummary;
  demoUsers: UserSummary[];
  initialOwned: DocumentSummary[];
  initialSharedWithMe: DocumentSummary[];
}

function formatUpdatedAt(iso: string): string {
  const date = new Date(iso);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

export function DashboardClient({
  currentUser,
  demoUsers,
  initialOwned,
  initialSharedWithMe,
}: DashboardClientProps) {
  const router = useRouter();
  const [owned, setOwned] = useState<DocumentSummary[]>(initialOwned);
  const [sharedWithMe, setSharedWithMe] =
    useState<DocumentSummary[]>(initialSharedWithMe);
  const [activeTab, setActiveTab] = useState<"all" | "owned" | "shared">("all");
  const [creating, setCreating] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);

  const [shareTarget, setShareTarget] = useState<DocumentSummary | null>(null);
  const [renameTarget, setRenameTarget] = useState<DocumentSummary | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<DocumentSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function refreshLists() {
    try {
      const res = await fetch("/api/documents");
      if (!res.ok) return;
      const data = await res.json();
      setOwned(data.owned ?? []);
      setSharedWithMe(data.sharedWithMe ?? []);
    } catch {
      // ignore transient refresh failure
    }
  }

  async function handleCreateDocument() {
    setCreating(true);
    setBannerError(null);
    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Untitled Document", contentHtml: "" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBannerError(data.error || "Unable to create document.");
        return;
      }
      router.push(`/docs/${data.id}`);
    } catch {
      setBannerError("Network error while creating document.");
    } finally {
      setCreating(false);
    }
  }

  function openRenameModal(doc: DocumentSummary) {
    setRenameTarget(doc);
    setRenameValue(doc.title);
    setRenameError(null);
  }

  async function handleRenameSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!renameTarget) return;

    const trimmed = renameValue.trim();
    if (!trimmed) {
      setRenameError("Title cannot be empty.");
      return;
    }
    if (trimmed.length > 120) {
      setRenameError("Title must be 120 characters or fewer.");
      return;
    }

    setRenaming(true);
    setRenameError(null);
    try {
      const res = await fetch(`/api/documents/${renameTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRenameError(data.error || "Failed to rename document.");
        return;
      }

      setOwned((prev) =>
        prev.map((item) =>
          item.id === renameTarget.id
            ? { ...item, title: data.title, updatedAt: data.updatedAt }
            : item
        )
      );
      setRenameTarget(null);
      router.refresh();
    } catch {
      setRenameError("Network error while renaming document.");
    } finally {
      setRenaming(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setBannerError(null);
    try {
      const res = await fetch(`/api/documents/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setBannerError(data.error || "Failed to delete document.");
        return;
      }
      setOwned((prev) => prev.filter((item) => item.id !== deleteTarget.id));
      setDeleteTarget(null);
      router.refresh();
    } catch {
      setBannerError("Network error while deleting document.");
    } finally {
      setDeleting(false);
    }
  }

  const showOwned = activeTab === "all" || activeTab === "owned";
  const showShared = activeTab === "all" || activeTab === "shared";

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link
            href="/"
            className="flex items-center gap-2.5 shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 rounded-md"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
              <FileText className="h-4 w-4" />
            </span>
            <span className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap">
              Ajaia Docs
            </span>
          </Link>

          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setImportOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900 whitespace-nowrap shrink-0"
            >
              <Upload className="h-4 w-4 text-slate-500" />
              <span>Import File</span>
            </button>

            <button
              type="button"
              onClick={handleCreateDocument}
              disabled={creating}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs sm:text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              <FilePlus2 className="h-4 w-4" />
              <span>{creating ? "Creating..." : "+ New Document"}</span>
            </button>

            <div className="h-6 w-px bg-slate-200 hidden sm:block" />

            <DemoUserSwitcher
              currentUser={currentUser}
              demoUsers={demoUsers}
              onSwitched={() => {
                refreshLists();
              }}
            />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 sm:px-6 py-8 sm:py-10 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Documents
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Signed in as{" "}
              <span className="font-medium text-slate-700">
                {currentUser.name}
              </span>{" "}
              ·{" "}
              <span className="tabular-nums">
                {owned.length} owned · {sharedWithMe.length} shared with you
              </span>
            </p>
          </div>

          <div
            role="tablist"
            aria-label="Filter documents"
            className="inline-flex items-center gap-1 rounded-lg bg-slate-200/70 p-1 self-start sm:self-auto"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "all"}
              onClick={() => setActiveTab("all")}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap tabular-nums ${
                activeTab === "all"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              All ({owned.length + sharedWithMe.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "owned"}
              onClick={() => setActiveTab("owned")}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap tabular-nums ${
                activeTab === "owned"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              My Documents ({owned.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "shared"}
              onClick={() => setActiveTab("shared")}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap tabular-nums ${
                activeTab === "shared"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Shared with Me ({sharedWithMe.length})
            </button>
          </div>
        </div>

        {bannerError && (
          <div
            role="alert"
            className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
              <span>{bannerError}</span>
            </div>
            <button
              type="button"
              onClick={() => setBannerError(null)}
              aria-label="Dismiss error"
              className="text-red-500 hover:text-red-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {showOwned && (
          <section aria-labelledby="my-docs-heading" className="space-y-3">
            <div className="flex items-center justify-between">
              <h2
                id="my-docs-heading"
                className="text-sm font-semibold text-slate-900 tabular-nums"
              >
                My Documents ({owned.length})
              </h2>
            </div>

            {owned.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center">
                <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                  <FileText className="h-5 w-5" />
                </div>
                <p className="text-sm font-semibold text-slate-900">
                  No documents yet
                </p>
                <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">
                  Start from a blank page or import a Markdown (.md) or plain
                  text (.txt) file.
                </p>
                <div className="mt-5 flex items-center justify-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleCreateDocument}
                    disabled={creating}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
                  >
                    <FilePlus2 className="h-4 w-4" />
                    <span>New Document</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setImportOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <Upload className="h-4 w-4" />
                    <span>Import File</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="hidden md:grid grid-cols-[minmax(0,1fr)_160px_185px_150px] items-center gap-4 border-b border-slate-200 bg-slate-50/70 px-5 py-2.5 text-xs font-medium text-slate-500">
                  <span>Title</span>
                  <span>Sharing</span>
                  <span>Last Updated</span>
                  <span className="text-right">Actions</span>
                </div>

                <ul className="divide-y divide-slate-200">
                  {owned.map((doc) => (
                    <li
                      key={doc.id}
                      className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_160px_185px_150px] items-center gap-3 md:gap-4 px-5 py-3.5 transition-colors hover:bg-slate-50/80"
                    >
                      <div className="min-w-0">
                        <Link
                          href={`/docs/${doc.id}`}
                          className="group inline-flex items-center gap-2.5 max-w-full"
                        >
                          <FileText className="h-4 w-4 shrink-0 text-blue-600" />
                          <span className="text-sm font-semibold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                            {doc.title}
                          </span>
                        </Link>
                      </div>

                      <div className="text-xs text-slate-600 tabular-nums">
                        {doc.shareCount === 0 ? (
                          <span className="text-slate-500">Private</span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
                            <Users className="h-3.5 w-3.5 text-slate-400" />
                            <span>
                              Shared with {doc.shareCount}{" "}
                              {doc.shareCount === 1 ? "person" : "people"}
                            </span>
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-slate-500 tabular-nums">
                        <time dateTime={doc.updatedAt} suppressHydrationWarning>
                          {formatUpdatedAt(doc.updatedAt)}
                        </time>
                      </div>

                      <div className="flex items-center md:justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openRenameModal(doc)}
                          title="Rename document"
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          <span className="md:sr-only">Rename</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setShareTarget(doc)}
                          title="Share document"
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-blue-600"
                        >
                          <Share2 className="h-3.5 w-3.5" />
                          <span className="md:sr-only">Share</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(doc)}
                          title="Delete document"
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span className="md:sr-only">Delete</span>
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        {showShared && (
          <section aria-labelledby="shared-docs-heading" className="space-y-3">
            <div className="flex items-center justify-between">
              <h2
                id="shared-docs-heading"
                className="text-sm font-semibold text-slate-900 tabular-nums"
              >
                Shared with Me ({sharedWithMe.length})
              </h2>
            </div>

            {sharedWithMe.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white px-6 py-10 text-center">
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                  <Users className="h-5 w-5" />
                </div>
                <p className="text-sm font-semibold text-slate-900">
                  No documents shared with {currentUser.name}
                </p>
                <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
                  When another workspace member shares a document with{" "}
                  {currentUser.email}, it will appear here with your Editor or
                  Viewer permissions.
                </p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="hidden md:grid grid-cols-[minmax(0,1fr)_180px_110px_185px] items-center gap-4 border-b border-slate-200 bg-slate-50/70 px-5 py-2.5 text-xs font-medium text-slate-500">
                  <span>Title</span>
                  <span>Owner</span>
                  <span>Access</span>
                  <span>Last Updated</span>
                </div>

                <ul className="divide-y divide-slate-200">
                  {sharedWithMe.map((doc) => (
                    <li
                      key={doc.id}
                      className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_180px_110px_185px] items-center gap-2.5 md:gap-4 px-5 py-3.5 transition-colors hover:bg-slate-50/80"
                    >
                      <div className="min-w-0">
                        <Link
                          href={`/docs/${doc.id}`}
                          className="group inline-flex items-center gap-2.5 max-w-full"
                        >
                          <FileText className="h-4 w-4 shrink-0 text-slate-500 group-hover:text-blue-600 transition-colors" />
                          <span className="text-sm font-semibold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                            {doc.title}
                          </span>
                        </Link>
                      </div>

                      <div className="text-xs text-slate-600 truncate">
                        <span className="md:hidden text-slate-400">Owner: </span>
                        <span className="font-medium text-slate-700">
                          {doc.ownerName}
                        </span>
                      </div>

                      <div className="text-xs font-medium">
                        {doc.role === "EDITOR" ? (
                          <span className="text-emerald-700">Editor</span>
                        ) : (
                          <span className="text-slate-600">Viewer</span>
                        )}
                      </div>

                      <div className="text-xs text-slate-500 tabular-nums">
                        <time dateTime={doc.updatedAt} suppressHydrationWarning>
                          {formatUpdatedAt(doc.updatedAt)}
                        </time>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}
      </main>

      <ImportFileModal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
      />

      {shareTarget && (
        <ShareModal
          isOpen={Boolean(shareTarget)}
          onClose={() => setShareTarget(null)}
          documentId={shareTarget.id}
          documentTitle={shareTarget.title}
          ownerId={shareTarget.ownerId}
          demoUsers={demoUsers}
          onSharesChanged={(nextShares) => {
            setOwned((prev) =>
              prev.map((item) =>
                item.id === shareTarget.id
                  ? { ...item, shareCount: nextShares.length }
                  : item
              )
            );
          }}
        />
      )}

      {renameTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="rename-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[1px]"
          onClick={(e) => {
            if (e.target === e.currentTarget && !renaming) {
              setRenameTarget(null);
            }
          }}
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2
                id="rename-modal-title"
                className="text-base font-semibold text-slate-900"
              >
                Rename Document
              </h2>
              <button
                type="button"
                onClick={() => setRenameTarget(null)}
                disabled={renaming}
                aria-label="Close modal"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleRenameSubmit}>
              <div className="p-6 space-y-3">
                <label
                  htmlFor="rename-doc-input"
                  className="block text-xs font-medium text-slate-700"
                >
                  Document title
                </label>
                <input
                  id="rename-doc-input"
                  type="text"
                  autoFocus
                  maxLength={120}
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/15"
                />
                {renameError && (
                  <p className="text-xs text-red-600">{renameError}</p>
                )}
              </div>
              <div className="flex justify-end gap-2.5 border-t border-slate-200 px-6 py-3.5">
                <button
                  type="button"
                  onClick={() => setRenameTarget(null)}
                  disabled={renaming}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={renaming}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {renaming ? "Saving..." : "Save Title"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[1px]"
          onClick={(e) => {
            if (e.target === e.currentTarget && !deleting) {
              setDeleteTarget(null);
            }
          }}
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="p-6">
              <h2
                id="delete-modal-title"
                className="text-base font-semibold text-slate-900"
              >
                Delete &ldquo;{deleteTarget.title}&rdquo;?
              </h2>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                This permanently removes the document and revokes access for all
                shared collaborators. This action cannot be undone.
              </p>
            </div>
            <div className="flex justify-end gap-2.5 border-t border-slate-200 px-6 py-3.5">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete Document"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
