"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import {
  AlertCircle,
  ArrowLeft,
  Bold,
  Check,
  ChevronDown,
  Download,
  Eye,
  FileCode2,
  Italic,
  List,
  ListOrdered,
  Printer,
  Redo2,
  Save,
  Share2,
  Underline as UnderlineIcon,
  Undo2,
} from "lucide-react";
import type { UserSummary } from "@/lib/auth";
import type { DocumentDetail, DocumentShareItem } from "@/lib/documents";
import { DemoUserSwitcher } from "@/components/DemoUserSwitcher";
import { ShareModal } from "@/components/ShareModal";

interface DocumentEditorClientProps {
  currentUser: UserSummary;
  demoUsers: UserSummary[];
  initialDocument: DocumentDetail;
}

type SaveStatus = "saved" | "unsaved" | "saving" | "error";

export function DocumentEditorClient({
  currentUser,
  demoUsers,
  initialDocument,
}: DocumentEditorClientProps) {
  const router = useRouter();

  const [doc, setDoc] = useState<DocumentDetail>(initialDocument);
  const [title, setTitle] = useState<string>(initialDocument.title);
  const [shares, setShares] = useState<DocumentShareItem[]>(
    initialDocument.shares
  );
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [exportingMd, setExportingMd] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Track toolbar re-renders whenever cursor selection or formatting changes
  const [, setToolbarTick] = useState(0);

  // Guard modal for navigating away or switching user with unsaved edits
  const [pendingNavAction, setPendingNavAction] = useState<
    null | { type: "dashboard" } | { type: "switch"; email: string }
  >(null);

  const lastSavedTitleRef = useRef(initialDocument.title);
  const lastSavedHtmlRef = useRef(initialDocument.contentHtml);
  const isDirtyRef = useRef(false);

  const editor = useEditor({
    immediatelyRender: false,
    editable: doc.canEdit,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
        underline: false,
      }),
      Underline,
    ],
    content: initialDocument.contentHtml || "<p></p>",
    editorProps: {
      attributes: {
        class: "ajaia-editor min-h-[620px] focus:outline-none",
        "aria-label": "Document editor content",
      },
    },
    onUpdate: ({ editor: activeEditor }) => {
      if (!doc.canEdit) return;
      const html = activeEditor.getHTML();
      const changed =
        html !== lastSavedHtmlRef.current ||
        title.trim() !== lastSavedTitleRef.current;
      isDirtyRef.current = changed;
      setSaveStatus(changed ? "unsaved" : "saved");
      setToolbarTick((t) => t + 1);
    },
    onSelectionUpdate: () => {
      setToolbarTick((t) => t + 1);
    },
    onTransaction: () => {
      setToolbarTick((t) => t + 1);
    },
  });

  useEffect(() => {
    if (editor && editor.isEditable !== doc.canEdit) {
      editor.setEditable(doc.canEdit);
    }
  }, [editor, doc.canEdit]);

  const handleTitleChange = (nextTitle: string) => {
    setTitle(nextTitle);
    const currentHtml = editor?.getHTML() ?? lastSavedHtmlRef.current;
    const changed =
      nextTitle.trim() !== lastSavedTitleRef.current ||
      currentHtml !== lastSavedHtmlRef.current;
    isDirtyRef.current = changed;
    setSaveStatus(changed ? "unsaved" : "saved");
  };

  const handleSave = useCallback(async (): Promise<boolean> => {
    if (!doc.canEdit || !editor) return false;

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setErrorMessage("Document title cannot be empty.");
      setSaveStatus("error");
      return false;
    }

    setSaveStatus("saving");
    setErrorMessage(null);
    try {
      const contentHtml = editor.getHTML();
      const res = await fetch(`/api/documents/${doc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: trimmedTitle,
          contentHtml,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setSaveStatus("error");
        setErrorMessage(data.error || "Failed to save document.");
        return false;
      }

      setDoc(data);
      setTitle(data.title);
      lastSavedTitleRef.current = data.title;
      lastSavedHtmlRef.current = editor.getHTML();
      isDirtyRef.current = false;
      setSaveStatus("saved");
      return true;
    } catch {
      setSaveStatus("error");
      setErrorMessage("Network error while saving changes.");
      return false;
    }
  }, [doc.canEdit, doc.id, editor, title]);

  // Cmd/Ctrl + S shortcut
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (doc.canEdit && saveStatus !== "saving") {
          void handleSave();
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [doc.canEdit, handleSave, saveStatus]);

  // Browser tab refresh/close warning
  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (isDirtyRef.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  function handleBackToDashboard() {
    if (isDirtyRef.current) {
      setPendingNavAction({ type: "dashboard" });
      return;
    }
    router.push("/");
  }

  async function executePendingNav(shouldSaveFirst: boolean) {
    if (!pendingNavAction) return;
    if (shouldSaveFirst) {
      const ok = await handleSave();
      if (!ok) return;
    }

    const action = pendingNavAction;
    isDirtyRef.current = false;
    setPendingNavAction(null);

    if (action.type === "dashboard") {
      router.push("/");
      return;
    }

    if (action.email === "__logout__") {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
      return;
    }

    const res = await fetch("/api/auth/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: action.email }),
    });
    if (res.ok) {
      router.refresh();
    }
  }

  useEffect(() => {
    if (!exportMenuOpen) return;
    function handleOutside(event: MouseEvent) {
      if (
        exportMenuRef.current &&
        !exportMenuRef.current.contains(event.target as Node)
      ) {
        setExportMenuOpen(false);
      }
    }
    function handleEsc(event: KeyboardEvent) {
      if (event.key === "Escape") setExportMenuOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [exportMenuOpen]);

  async function handleExportMarkdown() {
    setExportMenuOpen(false);
    setExportingMd(true);
    setErrorMessage(null);
    try {
      if (doc.canEdit && isDirtyRef.current) {
        const saved = await handleSave();
        if (!saved) return;
      }

      const res = await fetch(`/api/documents/${doc.id}/export?format=md`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrorMessage(data.error || "Failed to export document as Markdown.");
        return;
      }

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] || `${title.trim() || doc.title || "document"}.md`;

      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      setErrorMessage("Network error while exporting Markdown.");
    } finally {
      setExportingMd(false);
    }
  }

  function handleExportPdf() {
    setExportMenuOpen(false);
    window.print();
  }

  const toolbarBtnClass = (active: boolean) =>
    `inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
      active
        ? "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200"
        : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
    } disabled:opacity-40 disabled:pointer-events-none`;

  const currentHeadingLevel = editor?.isActive("heading", { level: 1 })
    ? "1"
    : editor?.isActive("heading", { level: 2 })
      ? "2"
      : editor?.isActive("heading", { level: 3 })
        ? "3"
        : "paragraph";

  return (
    <div className="min-h-screen bg-[#f8fafc] print:bg-white flex flex-col">
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white print:hidden">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <button
              type="button"
              onClick={handleBackToDashboard}
              title="Back to Dashboard"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900 shrink-0"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Dashboard</span>
            </button>

            <div className="min-w-0 flex-1 max-w-md">
              {doc.canEdit ? (
                <input
                  type="text"
                  value={title}
                  maxLength={120}
                  aria-label="Document title"
                  onChange={(e) => handleTitleChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void handleSave();
                    }
                  }}
                  placeholder="Untitled Document"
                  className="w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-base font-semibold text-slate-900 transition-colors hover:border-slate-200 focus:border-blue-500 focus:bg-white focus:outline-none truncate"
                />
              ) : (
                <h1 className="px-1 text-base font-semibold text-slate-900 truncate">
                  {doc.title}
                </h1>
              )}
            </div>

            <div className="hidden lg:flex items-center gap-2 text-xs shrink-0">
              {doc.canEdit ? (
                saveStatus === "saving" ? (
                  <span className="text-slate-500">Saving...</span>
                ) : saveStatus === "unsaved" ? (
                  <span className="text-amber-700 font-medium">
                    Unsaved changes
                  </span>
                ) : saveStatus === "error" ? (
                  <span className="text-red-600 font-medium">Save failed</span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-slate-500">
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Saved</span>
                  </span>
                )
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
                  <Eye className="h-3.5 w-3.5 text-slate-500" />
                  <span>View Only</span>
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {doc.canEdit && (
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saveStatus === "saving" || saveStatus === "saved"}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs sm:text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap"
              >
                <Save className="h-3.5 w-3.5" />
                <span>{saveStatus === "saving" ? "Saving..." : "Save"}</span>
              </button>
            )}

            {/* Export Dropdown (available to Owner, Editor, and Viewer) */}
            <div ref={exportMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setExportMenuOpen((prev) => !prev)}
                disabled={exportingMd}
                aria-expanded={exportMenuOpen}
                aria-haspopup="menu"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs sm:text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 whitespace-nowrap"
              >
                <Download className="h-3.5 w-3.5 text-slate-500" />
                <span className="hidden sm:inline">
                  {exportingMd ? "Exporting..." : "Export"}
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              </button>

              {exportMenuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-1.5 w-52 rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg z-50"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => void handleExportMarkdown()}
                    className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                  >
                    <FileCode2 className="h-4 w-4 text-slate-500 shrink-0" />
                    <div>
                      <p className="text-slate-900">Markdown (.md)</p>
                      <p className="text-[11px] font-normal text-slate-500">
                        Download formatted file
                      </p>
                    </div>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleExportPdf}
                    className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                  >
                    <Printer className="h-4 w-4 text-slate-500 shrink-0" />
                    <div>
                      <p className="text-slate-900">PDF / Print</p>
                      <p className="text-[11px] font-normal text-slate-500">
                        Print-ready document layout
                      </p>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {doc.isOwner ? (
              <button
                type="button"
                onClick={() => setShareModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs sm:text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900 whitespace-nowrap tabular-nums"
              >
                <Share2 className="h-3.5 w-3.5 text-slate-500" />
                <span>Share</span>
                {shares.length > 0 && (
                  <span className="text-slate-500">({shares.length})</span>
                )}
              </button>
            ) : !doc.canEdit ? (
              <span className="lg:hidden inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600">
                <Eye className="h-3.5 w-3.5" />
                <span>View Only</span>
              </span>
            ) : (
              <span className="hidden sm:inline text-xs font-medium text-emerald-700 px-1">
                Editor
              </span>
            )}

            <div className="h-6 w-px bg-slate-200 hidden sm:block" />

            <DemoUserSwitcher
              currentUser={currentUser}
              demoUsers={demoUsers}
              onBeforeSwitch={(targetEmail) => {
                if (isDirtyRef.current) {
                  setPendingNavAction({ type: "switch", email: targetEmail });
                  return false;
                }
                return true;
              }}
            />
          </div>
        </div>
      </header>

      {/* Sticky Formatting Toolbar (hidden in VIEWER mode) */}
      {doc.canEdit && (
        <div className="sticky top-16 z-20 border-b border-slate-200 bg-white/95 backdrop-blur-xs print:hidden">
          <div className="mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto px-4 sm:px-6 py-2">
            {/* Heading / Text Style Selector */}
            <div className="flex items-center gap-1 pr-2 border-r border-slate-200">
              <button
                type="button"
                disabled={!editor}
                onClick={() => editor?.chain().focus().setParagraph().run()}
                className={toolbarBtnClass(currentHeadingLevel === "paragraph")}
                title="Normal text"
              >
                Normal
              </button>
              <button
                type="button"
                disabled={!editor}
                onClick={() =>
                  editor?.chain().focus().toggleHeading({ level: 1 }).run()
                }
                className={toolbarBtnClass(currentHeadingLevel === "1")}
                title="Heading 1"
              >
                H1
              </button>
              <button
                type="button"
                disabled={!editor}
                onClick={() =>
                  editor?.chain().focus().toggleHeading({ level: 2 }).run()
                }
                className={toolbarBtnClass(currentHeadingLevel === "2")}
                title="Heading 2"
              >
                H2
              </button>
              <button
                type="button"
                disabled={!editor}
                onClick={() =>
                  editor?.chain().focus().toggleHeading({ level: 3 }).run()
                }
                className={toolbarBtnClass(currentHeadingLevel === "3")}
                title="Heading 3"
              >
                H3
              </button>
            </div>

            {/* Inline Formatting */}
            <div className="flex items-center gap-1 px-2 border-r border-slate-200">
              <button
                type="button"
                disabled={!editor}
                onClick={() => editor?.chain().focus().toggleBold().run()}
                aria-label="Bold"
                aria-pressed={Boolean(editor?.isActive("bold"))}
                title="Bold (Ctrl/Cmd + B)"
                className={toolbarBtnClass(Boolean(editor?.isActive("bold")))}
              >
                <Bold className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={!editor}
                onClick={() => editor?.chain().focus().toggleItalic().run()}
                aria-label="Italic"
                aria-pressed={Boolean(editor?.isActive("italic"))}
                title="Italic (Ctrl/Cmd + I)"
                className={toolbarBtnClass(Boolean(editor?.isActive("italic")))}
              >
                <Italic className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={!editor}
                onClick={() => editor?.chain().focus().toggleUnderline().run()}
                aria-label="Underline"
                aria-pressed={Boolean(editor?.isActive("underline"))}
                title="Underline (Ctrl/Cmd + U)"
                className={toolbarBtnClass(
                  Boolean(editor?.isActive("underline"))
                )}
              >
                <UnderlineIcon className="h-4 w-4" />
              </button>
            </div>

            {/* Lists */}
            <div className="flex items-center gap-1 px-2 border-r border-slate-200">
              <button
                type="button"
                disabled={!editor}
                onClick={() =>
                  editor?.chain().focus().toggleBulletList().run()
                }
                aria-label="Bulleted list"
                aria-pressed={Boolean(editor?.isActive("bulletList"))}
                title="Bulleted list"
                className={toolbarBtnClass(
                  Boolean(editor?.isActive("bulletList"))
                )}
              >
                <List className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={!editor}
                onClick={() =>
                  editor?.chain().focus().toggleOrderedList().run()
                }
                aria-label="Numbered list"
                aria-pressed={Boolean(editor?.isActive("orderedList"))}
                title="Numbered list"
                className={toolbarBtnClass(
                  Boolean(editor?.isActive("orderedList"))
                )}
              >
                <ListOrdered className="h-4 w-4" />
              </button>
            </div>

            {/* History */}
            <div className="flex items-center gap-1 pl-2">
              <button
                type="button"
                disabled={!editor || !editor.can().undo()}
                onClick={() => editor?.chain().focus().undo().run()}
                aria-label="Undo"
                title="Undo (Ctrl/Cmd + Z)"
                className={toolbarBtnClass(false)}
              >
                <Undo2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={!editor || !editor.can().redo()}
                onClick={() => editor?.chain().focus().redo().run()}
                aria-label="Redo"
                title="Redo (Ctrl/Cmd + Shift + Z)"
                className={toolbarBtnClass(false)}
              >
                <Redo2 className="h-4 w-4" />
              </button>
            </div>

            {/* Mobile save status */}
            <div className="ml-auto lg:hidden text-xs pl-3 shrink-0">
              {saveStatus === "saving" ? (
                <span className="text-slate-500">Saving...</span>
              ) : saveStatus === "unsaved" ? (
                <span className="text-amber-700 font-medium">Unsaved</span>
              ) : saveStatus === "error" ? (
                <span className="text-red-600 font-medium">Error</span>
              ) : (
                <span className="text-slate-500">Saved</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Error Toast / Read-Only Notice */}
      {errorMessage && (
        <div className="mx-auto w-full max-w-[816px] px-4 pt-5">
          <div
            role="alert"
            className="flex items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-xs font-medium text-red-700 hover:underline"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {!doc.canEdit && (
        <div className="mx-auto w-full max-w-[816px] px-4 pt-5 print:hidden">
          <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs text-slate-600">
            <span>
              You are viewing a read-only document owned by{" "}
              <strong className="font-semibold text-slate-900">
                {doc.owner.name}
              </strong>
              .
            </span>
            <span className="font-medium text-slate-500">View Only</span>
          </div>
        </div>
      )}

      {/* White Document Page Surface */}
      <main className="flex-1 px-4 py-6 sm:py-8 print:p-0">
        <div className="mx-auto max-w-[816px] rounded-xl border border-slate-200 bg-white px-7 py-10 sm:px-14 sm:py-14 shadow-xs print:max-w-none print:rounded-none print:border-none print:shadow-none print:p-0">
          <div className="hidden print:block mb-6 pb-3 border-b border-slate-200">
            <p className="text-xs text-slate-500">
              {title.trim() || doc.title} · Owned by {doc.owner.name}
            </p>
          </div>
          {editor ? (
            <EditorContent editor={editor} />
          ) : (
            <div className="min-h-[620px] space-y-4 animate-pulse">
              <div className="h-7 w-2/3 rounded bg-slate-100" />
              <div className="h-4 w-full rounded bg-slate-100" />
              <div className="h-4 w-5/6 rounded bg-slate-100" />
            </div>
          )}
        </div>

        <div className="mx-auto mt-4 flex max-w-[816px] items-center justify-between px-1 text-xs text-slate-500 print:hidden">
          <span>Owner: {doc.owner.name}</span>
          <span>
            {doc.canEdit ? "Press Cmd/Ctrl + S to save" : "Read-only access"}
          </span>
        </div>
      </main>

      {/* Owner Share Modal */}
      {doc.isOwner && (
        <ShareModal
          isOpen={shareModalOpen}
          onClose={() => setShareModalOpen(false)}
          documentId={doc.id}
          documentTitle={title.trim() || doc.title}
          ownerId={doc.ownerId}
          demoUsers={demoUsers}
          initialShares={shares}
          onSharesChanged={(next) => setShares(next)}
        />
      )}

      {/* Unsaved Changes Navigation Guard Modal */}
      {pendingNavAction && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="unsaved-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[1px]"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="p-6">
              <h2
                id="unsaved-modal-title"
                className="text-base font-semibold text-slate-900"
              >
                You have unsaved changes
              </h2>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Save your edits before leaving, or discard them to continue.
              </p>
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 px-6 py-3.5">
              <button
                type="button"
                onClick={() => setPendingNavAction(null)}
                className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Keep Editing
              </button>
              <button
                type="button"
                onClick={() => void executePendingNav(false)}
                className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={() => void executePendingNav(true)}
                className="rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Save &amp; Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
