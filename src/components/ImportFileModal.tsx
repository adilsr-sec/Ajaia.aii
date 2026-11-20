"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, FileText, Upload, X } from "lucide-react";

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_EXT_REGEX = /\.(txt|md)$/i;

interface ImportFileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ImportFileModal({ isOpen, onClose }: ImportFileModalProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  if (!isOpen) return null;

  function validateClientFile(file: File): string | null {
    if (!ALLOWED_EXT_REGEX.test(file.name)) {
      return "Unsupported file type. Only .txt and .md files are allowed.";
    }
    if (file.size === 0) {
      return "File is empty. Please choose a non-empty .txt or .md file.";
    }
    if (file.size > MAX_BYTES) {
      return "File exceeds the maximum size limit of 2 MB.";
    }
    return null;
  }

  function handleSelectFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    const validationErr = validateClientFile(file);
    if (validationErr) {
      setSelectedFile(null);
      setError(validationErr);
      return;
    }
    setSelectedFile(file);
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    handleSelectFile(file);
  }

  async function handleImport() {
    if (!selectedFile) {
      setError("Please select a .txt or .md file to import.");
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const res = await fetch("/api/documents/import", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to import document.");
        return;
      }

      handleClose();
      router.push(`/docs/${data.id}`);
      router.refresh();
    } catch {
      setError("Network error while uploading file. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  function handleClose() {
    if (uploading) return;
    setSelectedFile(null);
    setError(null);
    setIsDragging(false);
    onClose();
  }

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[1px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2
            id="import-modal-title"
            className="text-base font-semibold text-slate-900"
          >
            Import Document
          </h2>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close modal"
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
              isDragging
                ? "border-blue-500 bg-blue-50/50"
                : "border-slate-300 bg-slate-50/60 hover:border-slate-400 hover:bg-slate-50"
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".txt,.md,text/plain,text/markdown"
              className="hidden"
              onChange={(e) => {
                handleSelectFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />

            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600">
              <Upload className="h-5 w-5" />
            </div>

            <p className="text-sm font-medium text-slate-900">
              Drop a file here, or{" "}
              <span className="text-blue-600 underline underline-offset-2">
                browse your computer
              </span>
            </p>
            <p className="mt-1.5 text-xs text-slate-500">
              Supported file types: .txt, .md (Max 2 MB)
            </p>
          </div>

          {selectedFile && (
            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <FileText className="h-4 w-4 shrink-0 text-blue-600" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {selectedFile.name}
                  </p>
                  <p className="text-xs text-slate-500 tabular-nums">
                    {formatBytes(selectedFile.size)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedFile(null)}
                className="text-xs font-medium text-slate-500 hover:text-slate-900 px-2 py-1"
              >
                Clear
              </button>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2.5 border-t border-slate-200 px-6 py-3.5">
          <button
            type="button"
            onClick={handleClose}
            disabled={uploading}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={!selectedFile || uploading}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {uploading ? "Importing..." : "Import & Open"}
          </button>
        </div>
      </div>
    </div>
  );
}
