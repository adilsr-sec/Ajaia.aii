import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, FileX2, ShieldAlert } from "lucide-react";
import { getCurrentUser, getDemoUsers } from "@/lib/auth";
import { getDocumentById } from "@/lib/documents";
import { ServiceError } from "@/lib/errors";
import { DocumentEditorClient } from "@/components/DocumentEditorClient";
import { DemoUserSwitcher } from "@/components/DemoUserSwitcher";

export const dynamic = "force-dynamic";

interface DocumentPageProps {
  params: Promise<{ id: string }>;
}

export default async function DocumentPage({ params }: DocumentPageProps) {
  const { id } = await params;
  const user = await getCurrentUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/docs/${id}`)}`);
  }

  const demoUsers = await getDemoUsers();

  try {
    const doc = await getDocumentById(user.id, id);
    return (
      <DocumentEditorClient
        key={`${doc.id}-${user.id}-${doc.role}`}
        currentUser={user}
        demoUsers={demoUsers}
        initialDocument={doc}
      />
    );
  } catch (err) {
    if (err instanceof ServiceError && (err.status === 403 || err.status === 404)) {
      const isForbidden = err.status === 403;
      return (
        <div className="min-h-screen bg-[#f8fafc] flex flex-col">
          <header className="border-b border-slate-200 bg-white">
            <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 hover:text-slate-900"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back to Dashboard</span>
              </Link>
              <DemoUserSwitcher currentUser={user} demoUsers={demoUsers} />
            </div>
          </header>

          <main className="flex-1 flex items-center justify-center px-6 py-16">
            <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-xs">
              <div
                className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl ${
                  isForbidden
                    ? "bg-amber-50 text-amber-600"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {isForbidden ? (
                  <ShieldAlert className="h-6 w-6" />
                ) : (
                  <FileX2 className="h-6 w-6" />
                )}
              </div>
              <h1 className="text-lg font-bold text-slate-900">
                {isForbidden ? "Access Denied" : "Document Not Found"}
              </h1>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                {isForbidden
                  ? `${user.name} (${user.email}) does not have permission to view this document. Ask the owner to share it, or switch demo accounts in the top right.`
                  : "This document does not exist or may have been deleted by its owner."}
              </p>
              <div className="mt-6">
                <Link
                  href="/"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>Return to Dashboard</span>
                </Link>
              </div>
            </div>
          </main>
        </div>
      );
    }

    throw err;
  }
}
